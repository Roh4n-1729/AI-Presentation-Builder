import { applyPatches, enablePatches, produceWithPatches } from 'immer';
import { applyOps, findElement, OpError } from '../lib/ops/index.js';
import { revealTarget, touchedIds } from './affected.js';

enablePatches();

export const HISTORY_LIMIT = 100;
let entrySeq = 0;

/**
 * @typedef {{ id: string, label: string, source: 'user'|'ai', turnId: string|null,
 *   patches: import('immer').Patch[], inversePatches: import('immer').Patch[], opCount: number }} HistoryEntry
 * @typedef {{ label?: string, source?: 'user'|'ai', turnId?: string|null }} DispatchMeta
 * @typedef {{ ok: true, changed: boolean, historyEntryId?: string } | { ok: false, error: { code: string, message: string } }} DispatchResult
 */

/** Drop UI references to things that no longer exist after a deck change (delete, undo, AI op). */
export function reconcileUi(state, deck) {
  const selection = state.selection.filter((id) => findElement(deck, id));
  const editingId = state.editingId && findElement(deck, state.editingId) ? state.editingId : null;
  const activeSlideId = deck.slides[state.activeSlideId]
    ? state.activeSlideId
    : (deck.slideOrder[0] ?? null);
  const changed =
    selection.length !== state.selection.length ||
    editingId !== state.editingId ||
    activeSlideId !== state.activeSlideId;
  return changed ? { selection, editingId, activeSlideId } : {};
}

let revealSeq = 0;
let flashSeq = 0;

/** Record which elements an AI op touched so their slide can glow them (saffron = the AI, D17). */
function flashFor(prev, deck, patches) {
  const { slideIds, elementIds } = touchedIds(patches);
  const next = { ...prev };
  for (const sid of slideIds) {
    if (!deck.slides[sid]) continue;
    const ids = elementIds.filter((id) => deck.slides[sid].elements[id]);
    if (ids.length) next[sid] = { elementIds: ids, seq: ++flashSeq };
  }
  return next;
}

/**
 * After undo/redo, show what changed: select the affected elements (on one slide) and publish a
 * `reveal` that the canvas uses to scroll that slide into view and flash the change.
 */
function revealUi(deck, entry) {
  const target = revealTarget(deck, [entry.patches, entry.inversePatches]);
  if (!target) return { reveal: null };
  return {
    selection: target.elementIds,
    editingId: null,
    reveal: { ...target, label: entry.label, seq: ++revealSeq },
  };
}

/**
 * The canonical deck and its history (D2, D10). `dispatch` is the only way the deck changes:
 * canvas gestures, shortcuts, editors and (later) streamed AI ops all call it.
 */
export const createDeckSlice = (initialDeck) => (set, get) => ({
  deck: initialDeck,
  /** @type {HistoryEntry[]} */ past: [],
  /** @type {HistoryEntry[]} */ future: [],
  revision: 0, // bumps on every change; autosave watches it
  /** last undo/redo target: { slideId, elementIds, label, seq } (canvas scrolls + flashes it) */
  reveal: null,
  /** elements the AI just changed, per slide: { [slideId]: { elementIds, seq } } (saffron glow) */
  aiFlash: {},
  lastError: null,

  /**
   * Apply one op or a batch (one batch = one undo entry). All-or-nothing: if any op fails,
   * the deck is unchanged and the error is returned (and kept in `lastError` for a toast).
   *
   * History grouping (D25): an AI op joins the top entry only if that entry belongs to the same
   * AI turn. Any user edit pushes its own entry, so a turn interrupted by the user becomes two
   * entries and undo never applies old inverse patches on top of newer edits.
   *
   * @param {object | object[]} input
   * @param {DispatchMeta} [meta]
   * @returns {DispatchResult}
   */
  dispatch(input, meta = {}) {
    const ops = Array.isArray(input) ? input : [input];
    if (ops.length === 0) return { ok: true, changed: false };
    const { label = ops[0]?.type ?? 'edit', source = 'user', turnId = null } = meta;

    let next, patches, inversePatches;
    try {
      [next, patches, inversePatches] = produceWithPatches(get().deck, (draft) =>
        applyOps(draft, ops),
      );
    } catch (err) {
      const error =
        err instanceof OpError
          ? { code: err.code, message: err.message }
          : { code: 'INTERNAL', message: String(err?.message ?? err) };
      if (!(err instanceof OpError)) console.error(err);
      set({ lastError: { ...error, label, at: Date.now() } });
      return { ok: false, error };
    }
    if (patches.length === 0) return { ok: true, changed: false };

    let entryId;
    set((s) => {
      const top = s.past.at(-1);
      const joinTop = source === 'ai' && turnId && top?.source === 'ai' && top.turnId === turnId;
      const entry = joinTop
        ? {
            ...top,
            patches: [...top.patches, ...patches],
            inversePatches: [...inversePatches, ...top.inversePatches], // undo newest first
            opCount: top.opCount + ops.length,
          }
        : {
            id: `h${++entrySeq}`,
            label,
            source,
            turnId,
            patches,
            inversePatches,
            opCount: ops.length,
          };
      entryId = entry.id;
      const past = joinTop
        ? [...s.past.slice(0, -1), entry]
        : [...s.past, entry].slice(-HISTORY_LIMIT);
      return {
        deck: next,
        past,
        future: [],
        revision: s.revision + 1,
        lastError: null,
        ...reconcileUi(s, next),
        ...(source === 'ai' ? { aiFlash: flashFor(s.aiFlash, next, patches) } : {}),
      };
    });
    return { ok: true, changed: true, historyEntryId: entryId };
  },

  undo() {
    const { past, deck, aiBusy } = get();
    if (aiBusy) return false; // D10: no undo while an AI turn is still streaming
    const entry = past.at(-1);
    if (!entry) return false;
    const next = applyPatches(deck, entry.inversePatches);
    set((s) => ({
      deck: next,
      past: s.past.slice(0, -1),
      future: [entry, ...s.future],
      revision: s.revision + 1,
      ...reconcileUi(s, next),
      ...revealUi(next, entry),
    }));
    return true;
  },

  redo() {
    const { future, deck, aiBusy } = get();
    if (aiBusy) return false;
    const entry = future[0];
    if (!entry) return false;
    const next = applyPatches(deck, entry.patches);
    set((s) => ({
      deck: next,
      past: [...s.past, entry],
      future: s.future.slice(1),
      revision: s.revision + 1,
      ...reconcileUi(s, next),
      ...revealUi(next, entry),
    }));
    return true;
  },

  /** Swap in a whole deck (load sample, new deck, import). Not undoable; clears history. */
  replaceDeck(deck) {
    set((s) => ({
      deck,
      past: [],
      future: [],
      revision: s.revision + 1,
      lastError: null,
      reveal: null,
      aiFlash: {},
      selection: [],
      editingId: null,
      activeSlideId: deck.slideOrder[0] ?? null,
    }));
  },

  clearError: () => set({ lastError: null }),

  /** Point the user at something (op chip click): select it, scroll to it, flash it. */
  showInCanvas({ slideId, elementIds = [], label = '' }) {
    const deck = get().deck;
    if (!slideId || !deck.slides[slideId]) return;
    const ids = elementIds.filter((id) => deck.slides[slideId].elements[id]);
    set({
      selection: ids,
      editingId: null,
      reveal: { slideId, elementIds: ids, label, seq: ++revealSeq },
    });
  },
});
