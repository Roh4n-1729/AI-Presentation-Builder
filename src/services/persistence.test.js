import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleDeck } from '../lib/sampleDeck.js';
import { createAppStore } from '../store/index.js';
import {
  clearWorkspace,
  loadWorkspace,
  sanitizeMessages,
  saveWorkspace,
  startAutosave,
} from './persistence.js';

describe('persistence (IndexedDB via fake-indexeddb)', () => {
  beforeEach(() => clearWorkspace());

  it('round-trips deck and chat', async () => {
    const deck = createSampleDeck();
    const messages = [{ id: 'm1', role: 'user', text: 'hi' }];
    await saveWorkspace({ deck, messages });
    const loaded = await loadWorkspace();
    expect(loaded.deck).toEqual(deck);
    expect(loaded.messages).toEqual(messages);
  });

  it('returns null when nothing (or only an empty deck) is saved', async () => {
    expect(await loadWorkspace()).toBeNull();
    const deck = createSampleDeck();
    await saveWorkspace({ deck: { ...deck, slideOrder: [], slides: {} }, messages: [] });
    expect(await loadWorkspace()).toBeNull();
  });

  it('rejects an invalid deck instead of loading it', async () => {
    const deck = createSampleDeck();
    await saveWorkspace({ deck: { ...deck, slideOrder: ['s_missing'] }, messages: [] });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadWorkspace()).toBeNull();
  });

  it('a run that was streaming at save time comes back as stopped', () => {
    const [m] = sanitizeMessages([
      {
        id: 'a',
        role: 'assistant',
        status: 'streaming',
        activity: 'Writing text',
        phase: 'populating',
      },
    ]);
    expect(m).toEqual({ id: 'a', role: 'assistant', status: 'stopped', phase: 'done' });
  });
});

describe('autosave', () => {
  afterEach(() => vi.useRealTimers());

  it('debounces deck changes into one save and reports status', async () => {
    vi.useFakeTimers();
    const store = createAppStore(createSampleDeck());
    const save = vi.fn().mockResolvedValue();
    const auto = startAutosave(store, { delay: 500, save });
    const { dispatch } = store.getState();
    dispatch({ type: 'update_deck', patch: { title: 'A' } });
    dispatch({ type: 'update_deck', patch: { title: 'B' } });
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
