import 'fake-indexeddb/auto';
import { createStore, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleDeck } from '../lib/sampleDeck.js';
import { createAppStore } from '../store/index.js';
import {
  deleteProject,
  getCurrentProjectId,
  listProjects,
  loadProject,
  MAX_PROJECTS,
  sanitizeMessages,
  saveProject,
  startAutosave,
} from './persistence.js';

const deckWithId = (id, title = id) => ({ ...createSampleDeck(), id, title });
describe('projects in IndexedDB (fake-indexeddb)', () => {
  beforeEach(async () => {
    await saveProject({ deck: deckWithId('d_reset'), messages: [] });
    for (const p of await listProjects()) await deleteProject(p.id);
  });

  it('round-trips a project and lists it with a cover', async () => {
    const deck = deckWithId('d_one', 'One');
    const messages = [{ id: 'm1', role: 'user', text: 'hi' }];
    await saveProject({ deck, messages });
    const loaded = await loadProject('d_one');
    expect(loaded.deck).toEqual(deck);
    expect(loaded.messages).toEqual(messages);
    const [entry] = await listProjects();
    expect(entry).toMatchObject({ id: 'd_one', title: 'One', slideCount: deck.slideOrder.length });
    expect(entry.cover.id).toBe(deck.slideOrder[0]);
  });

  it(`keeps the ${MAX_PROJECTS} most recently saved, newest first`, async () => {
    for (let i = 1; i <= MAX_PROJECTS + 2; i++) {
      await saveProject({ deck: deckWithId(`d_${i}`), messages: [] });
    }
    await saveProject({ deck: deckWithId('d_3', 'touched'), messages: [] }); // moves to the top
    const ids = (await listProjects()).map((p) => p.id);
    expect(ids).toEqual(['d_3', 'd_7', 'd_6', 'd_5', 'd_4']);
    expect(await loadProject('d_1')).toBeNull(); // evicted for real, not just unlisted
  });

  it('does not save an empty deck with no chat', async () => {
    const deck = { ...deckWithId('d_empty'), slideOrder: [], slides: {} };
    await saveProject({ deck, messages: [] });
    expect(await listProjects()).toEqual([]);
  });

  it('rejects an invalid deck instead of loading it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await saveProject({
      deck: { ...deckWithId('d_bad'), slideOrder: ['s_missing'] },
      messages: [],
    });
    expect(await loadProject('d_bad')).toBeNull();
  });

  it('a run that was streaming at save time comes back as stopped', () => {
    const [m] = sanitizeMessages([
      { id: 'a', role: 'assistant', status: 'streaming', activity: 'Writing', phase: 'populating' },
    ]);
    expect(m).toEqual({ id: 'a', role: 'assistant', status: 'stopped', phase: 'done' });
  });
});

describe('legacy single-workspace record (D39)', () => {
  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
  });

  it('is migrated into the project list and opened', async () => {
    const deck = deckWithId('d_legacy', 'Old one');
    await set(
      'workspace',
      { version: 1, deck, messages: [], savedAt: 1 },
      createStore('ai-presentation-builder', 'kv'),
    );
    expect((await listProjects()).map((p) => p.id)).toEqual(['d_legacy']);
    expect(await getCurrentProjectId()).toBe('d_legacy');
  });
});

describe('autosave', () => {
  afterEach(() => vi.useRealTimers());

  it('debounces deck changes into one save and reports status', async () => {
    vi.useFakeTimers();
    const store = createAppStore(createSampleDeck());
    const save = vi.fn().mockResolvedValue();
    const auto = startAutosave(store, { delay: 500, save });
    store.getState().dispatch({ type: 'update_deck', patch: { title: 'A' } });
    store.getState().dispatch({ type: 'update_deck', patch: { title: 'B' } });
    expect(store.getState().saveStatus).toBe('unsaved');
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].deck.title).toBe('B');
    expect(store.getState().saveStatus).toBe('saved');
    auto.stop();
  });

  it('keeps saving during a continuous stream of changes (maxWait)', async () => {
    vi.useFakeTimers();
    const store = createAppStore(createSampleDeck());
    const save = vi.fn().mockResolvedValue();
    const auto = startAutosave(store, { delay: 500, maxWait: 2000, save });
    for (let i = 0; i < 25; i++) {
      store.getState().dispatch({ type: 'update_deck', patch: { title: `T${i}` } });
      await vi.advanceTimersByTimeAsync(200); // a change every 200 ms, never a 500 ms pause
    }
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);
    auto.stop();
  });

  it('switching projects is not an edit, and pending edits land on their own project', async () => {
    vi.useFakeTimers();
    const store = createAppStore(deckWithId('d_a'));
    const save = vi.fn().mockResolvedValue();
    const auto = startAutosave(store, { delay: 500, save });
    store.getState().dispatch({ type: 'update_deck', patch: { title: 'edited A' } });
    store.getState().replaceDeck(deckWithId('d_b')); // switch before the debounce fires
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].deck).toMatchObject({ id: 'd_a', title: 'edited A' });
    auto.stop();
  });

  it('shows an error status when saving fails', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createAppStore(createSampleDeck());
    const auto = startAutosave(store, {
      delay: 10,
      save: () => Promise.reject(new Error('quota')),
    });
    store.getState().dispatch({ type: 'update_deck', patch: { title: 'X' } });
    await vi.advanceTimersByTimeAsync(20);
    expect(store.getState().saveStatus).toBe('error');
    auto.stop();
  });
});
