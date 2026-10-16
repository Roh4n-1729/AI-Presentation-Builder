import { DeckSchema } from '../lib/schema/index.js';
import { createIdbStore } from './kvStore.js';

/*
 * Local persistence (D20, D40, D52): up to MAX_PROJECTS presentations (deck + chat each) in
 * IndexedDB through a small key-value store (`kvStore.js`, idb-keyval underneath; tests swap in
 * an in-memory one). IndexedDB, not localStorage: decks with uploaded images run to megabytes, and
 * writes are async so autosave never blocks typing. Nothing leaves the browser.
 *
 *   projects         [{ id, title, slideCount, updatedAt, cover }]   newest first (the index)
 *   project:<id>     { version, deck, messages, savedAt }
 *   currentProject   id of the deck open in the editor (null on the StartScreen)
 */

export const MAX_PROJECTS = 5;
export const WORKSPACE_VERSION = 1;
const INDEX_KEY = 'projects';
const CURRENT_KEY = 'currentProject';
const LEGACY_KEY = 'workspace'; // single-deck format from D39
const projectKey = (id) => `project:${id}`;
const MAX_SAVED_MESSAGES = 100;

let kv;
const db = () => (kv ??= createIdbStore());

/** Point persistence at another store (tests use `createMemoryStore()`). */
export function setStorage(store) {
  kv = store;
}

/**
 * Chat messages as they should come back after a reload: a run that was streaming when the page
 * closed is shown as stopped (its ops are already in the deck), transient fields are dropped.
 */
export function sanitizeMessages(messages) {
  return messages.slice(-MAX_SAVED_MESSAGES).map((m) => {
    if (m.role !== 'assistant') return m;
    // eslint-disable-next-line no-unused-vars -- dropping transient fields
    const { activity, ...rest } = m;
    return rest.status === 'streaming'
      ? { ...rest, status: 'stopped', phase: rest.phase ? 'done' : rest.phase }
      : rest;
  });
}

const isEmpty = (deck, messages) => deck.slideOrder.length === 0 && messages.length === 0;

/** Index entry: what the StartScreen needs to list a project without loading it. */
const entryFor = (deck, updatedAt) => ({
  id: deck.id,
  title: deck.title,
  slideCount: deck.slideOrder.length,
  updatedAt,
  cover: deck.slideOrder.length ? deck.slides[deck.slideOrder[0]] : null,
  theme: deck.theme,
});

/** @returns {Promise<Array<ReturnType<typeof entryFor>>>} newest first */
export async function listProjects() {
  await migrateLegacy();
  try {
    return (await db().get(INDEX_KEY)) ?? [];
  } catch (err) {
    console.warn('[persistence] IndexedDB unavailable:', err);
    return [];
  }
}

/** @returns {Promise<{ deck: object, messages: object[], savedAt: number } | null>} */
export async function loadProject(id) {
  const raw = await db()
    .get(projectKey(id))
    .catch(() => null);
  if (!raw) return null;
  const parsed = DeckSchema.safeParse(raw.deck);
  if (raw.version !== WORKSPACE_VERSION || !parsed.success) {
    console.warn('[persistence] project is unreadable:', id, parsed.error);
    return null;
  }
  const messages = Array.isArray(raw.messages) ? sanitizeMessages(raw.messages) : [];
  return { deck: parsed.data, messages, savedAt: raw.savedAt ?? 0 };
}

/**
 * Save one project and move it to the top of the index. Keeps the MAX_PROJECTS most recently
 * updated; older ones are deleted (the StartScreen says so). A new, empty deck with no chat is
 * not saved, so "Start blank" and abandoned starts don't fill the list. A project that was saved
 * before is saved even when emptied, or the old contents would come back on reload (D72).
 */
export async function saveProject({ deck, messages }) {
  if (isEmpty(deck, messages) && !(await db().get(projectKey(deck.id)))) return;
  const savedAt = Date.now();
  await db().set(projectKey(deck.id), {
    version: WORKSPACE_VERSION,
    deck,
    messages: sanitizeMessages(messages),
    savedAt,
  });
  const index = ((await db().get(INDEX_KEY)) ?? []).filter((p) => p.id !== deck.id);
  const next = [entryFor(deck, savedAt), ...index];
  for (const old of next.slice(MAX_PROJECTS)) await db().del(projectKey(old.id));
  await db().set(INDEX_KEY, next.slice(0, MAX_PROJECTS));
}

export async function deleteProject(id) {
  await db().del(projectKey(id));
  const index = ((await db().get(INDEX_KEY)) ?? []).filter((p) => p.id !== id);
  await db().set(INDEX_KEY, index);
  if ((await getCurrentProjectId()) === id) await setCurrentProjectId(null);
}

export const getCurrentProjectId = () =>
  db()
    .get(CURRENT_KEY)
    .catch(() => null);
export const setCurrentProjectId = (id) =>
  db()
    .set(CURRENT_KEY, id)
    .catch(() => {});

/** One-time move of the D39 single-workspace record into the project list. */
async function migrateLegacy() {
  const legacy = await db()
    .get(LEGACY_KEY)
    .catch(() => null);
  if (!legacy) return;
  await db().del(LEGACY_KEY);
  if (legacy.version === WORKSPACE_VERSION && DeckSchema.safeParse(legacy.deck).success) {
    await saveProject({ deck: legacy.deck, messages: legacy.messages ?? [] });
    await setCurrentProjectId(legacy.deck.id);
  }
}

/**
 * Save the open project shortly after it changes (debounced, at most `maxWait` behind during a
 * continuous stream of changes such as an AI run), and right away when the tab is hidden or closed.
 * Switching to another project is not a change: call `flush()` before switching so pending edits
 * land on the project they belong to.
 *
 * @param {ReturnType<import('../store/index.js').createAppStore>} store
 * @param {{ delay?: number, maxWait?: number, save?: typeof saveProject }} [opts]
 */
export function startAutosave(store, { delay = 600, maxWait = 2000, save = saveProject } = {}) {
  let timer = null;
  let pending = null; // { deck, messages } snapshot of the project that has unsaved changes
  let firstDirtyAt = 0; // a stream of changes (an AI run) would otherwise postpone saving forever
  let saving = Promise.resolve();

  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (!pending) return saving;
    const snapshot = pending;
    pending = null;
    firstDirtyAt = 0;
    store.getState().setSaveStatus('saving');
    saving = saving
      .then(() => save(snapshot))
      .then(
        () => !pending && store.getState().setSaveStatus('saved'),
        (err) => {
          console.error('[persistence] save failed:', err);
          store.getState().setSaveStatus('error');
        },
      );
    return saving;
  };

  const unsubscribe = store.subscribe((s, prev) => {
    if (s.deck === prev.deck && s.messages === prev.messages) return;
    if (s.deck.id !== prev.deck.id) return; // a project switch, not an edit
    pending = { deck: s.deck, messages: s.messages };
    if (s.saveStatus !== 'unsaved') s.setSaveStatus('unsaved');
    const now = Date.now();
    firstDirtyAt ||= now;
    clearTimeout(timer);
    // debounce, but never wait more than maxWait since the first unsaved change
    timer = setTimeout(flush, Math.max(0, Math.min(delay, firstDirtyAt + maxWait - now)));
  });

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  const hasDom = typeof document !== 'undefined';
  if (hasDom) {
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
  }

  return {
    flush,
    stop() {
      unsubscribe();
      clearTimeout(timer);
      if (hasDom) {
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', flush);
      }
    },
  };
}
