import { findElement } from '../lib/ops/index.js';

/** Editor UI state: not part of the deck, not in history. */
export const createUiSlice = (initialDeck) => (set) => ({
  /** @type {string[]} selected element ids (always on one slide) */
  selection: [],
  activeSlideId: initialDeck.slideOrder[0] ?? null,
  /** element in text/cell edit mode */
  editingId: null,
  /** slide whose element is being dragged: its frame sits above its siblings with overflow visible */
  draggingSlideId: null,
  /** drop target during a cross-slide drag: { slideId, copy } (copy = Alt held) */
  dropTarget: null,
  /** 'loading' (reading IndexedDB) | 'start' (StartScreen) | 'editor' */
  screen: 'loading',
  /** autosave state for the top bar: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' */
  saveStatus: 'idle',

  setScreen: (screen) => set((s) => (s.screen === screen ? s : { screen })),
  setSaveStatus: (saveStatus) => set((s) => (s.saveStatus === saveStatus ? s : { saveStatus })),

  select(id, additive = false) {
    set((s) => {
      // editingId is NOT cleared here: the editor's own blur commits and exits. Clearing it here
      // would unmount the editor before blur could save (spike gotcha 6).
      if (!id) return s.selection.length ? { selection: [] } : s;
      if (!additive) return { selection: [id] };
      // Additive selection stays within one slide, so a group never spans slides.
      const slideOf = (eid) => findElement(s.deck, eid)?.slide.id;
      const base = s.selection.filter((eid) => slideOf(eid) === slideOf(id));
      return { selection: base.includes(id) ? base.filter((x) => x !== id) : [...base, id] };
    });
  },
  setSelection: (ids) => set({ selection: ids }),
  setActiveSlide: (id) => set((s) => (s.activeSlideId === id ? s : { activeSlideId: id })),
  setEditing: (id) => set((s) => (s.editingId === id ? s : { editingId: id })),
  setDragging: (slideId) =>
    set((s) => (s.draggingSlideId === slideId ? s : { draggingSlideId: slideId })),
  /** @param {string|null} slideId @param {boolean} [copy] */
  setDropTarget: (slideId, copy = false) =>
    set((s) => {
      const cur = s.dropTarget;
      if (!slideId) return cur ? { dropTarget: null } : s;
      if (cur && cur.slideId === slideId && cur.copy === copy) return s;
      return { dropTarget: { slideId, copy } };
    }),
});
