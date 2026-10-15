import { createStore, del, get, set } from 'idb-keyval';
import { DeckSchema } from '../lib/schema/index.js';

/*
 * Local persistence (D20): one workspace (deck + chat) in IndexedDB via idb-keyval.
 * IndexedDB, not localStorage: decks with uploaded images run to megabytes, and writes are async
 * so autosave never blocks typing. Everything stays in the browser; there is no server copy.
 */

const KEY = 'workspace';
const BACKUP_KEY = 'workspace:unreadable';
export const WORKSPACE_VERSION = 1;
const MAX_SAVED_MESSAGES = 100;

let kv;
const db = () => (kv ??= createStore('ai-presentation-builder', 'kv'));

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

/**
 * @returns {Promise<{ deck: object, messages: object[], savedAt: number } | null>}
 *   null when nothing usable is stored (first visit, an empty workspace, or unreadable data)
 */
export async function loadWorkspace() {
  let raw;
  try {
    raw = await get(KEY, db());
  } catch (err) {
    console.warn('[persistence] IndexedDB unavailable:', err);
    return null;
  }
  if (!raw) return null;
  const parsed = DeckSchema.safeParse(raw.deck);
  if (raw.version !== WORKSPACE_VERSION || !parsed.success) {
    // Keep what we couldn't read instead of overwriting it on the next autosave.
    console.warn('[persistence] saved workspace is unreadable; kept as a backup', parsed.error);
    await set(BACKUP_KEY, raw, db()).catch(() => {});
    await del(KEY, db()).catch(() => {});
    return null;
  }
  const messages = Array.isArray(raw.messages) ? sanitizeMessages(raw.messages) : [];
  if (parsed.data.slideOrder.length === 0 && messages.length === 0) return null;
  return { deck: parsed.data, messages, savedAt: raw.savedAt ?? 0 };
}

export async function saveWorkspace({ deck, messages }) {
  await set(
    KEY,
    { version: WORKSPACE_VERSION, deck, messages: sanitizeMessages(messages), savedAt: Date.now() },
    db(),
  );
}

export async function clearWorkspace() {
  await del(KEY, db());
}

/**
 * Save the deck and chat shortly after they change (debounced, at most `maxWait` behind during a
 * continuous stream of changes such as an AI run), and right away when the tab is hidden or closed.
 *
 * @param {ReturnType<import('../store/index.js').createAppStore>} store
 * @param {{ delay?: number, maxWait?: number, save?: typeof saveWorkspace }} [opts]
 */
export function startAutosave(store, { delay = 600, maxWait = 2000, save = saveWorkspace } = {}) {
  let timer = null;
  let dirty = false;
  let firstDirtyAt = 0; // a stream of changes (an AI run) would otherwise postpone saving forever
  let saving = Promise.resolve();

  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (!dirty) return saving;
    dirty = false;
    firstDirtyAt = 0;
    const { deck, messages, setSaveStatus } = store.getState();
    setSaveStatus('saving');
    saving = saving
      .then(() => save({ deck, messages }))
      .then(
        () => !dirty && store.getState().setSaveStatus('saved'),
        (err) => {
          console.error('[persistence] save failed:', err);
          store.getState().setSaveStatus('error');
        },
      );
    return saving;
  };

  const unsubscribe = store.subscribe((s, prev) => {
    if (s.deck === prev.deck && s.messages === prev.messages) return;
    dirty = true;
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
