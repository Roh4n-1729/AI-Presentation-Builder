import { SIDE_WIDTH } from '../lib/constants.js';
import { expandToGroups } from '../lib/groups.js';
import { findElement } from '../lib/ops/index.js';

let toastSeq = 0;

const clampSide = (w) => Math.round(Math.max(SIDE_WIDTH.min, Math.min(SIDE_WIDTH.max, w)));

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
  /** editor chrome scheme; slides follow it for display (D40). Set before first paint by index.html. */
  colorScheme: globalThis.document?.documentElement.classList.contains('dark') ? 'dark' : 'light',
  /** side panels shown in the editor (per-browser preference, see useChromePrefs) */
  panels: { filmstrip: true, chat: true },
  /** right-hand panel width (drag its left edge, or the expand button) */
  sideWidth: SIDE_WIDTH.default,
  /** data editor drawer for a chart or table: { elementId } | null (opens over the AI panel) */
  drawer: null,
  /** print view mounted (renders every slide for the browser's print / Save as PDF) */
  printing: false,
  /** present mode: { index } of the slide on screen, or null */
  presenting: null,
  /** 'loading' (reading IndexedDB) | 'start' (StartScreen) | 'editor' */
  screen: 'loading',
  /** autosave state for the top bar: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' */
  saveStatus: 'idle',
  /** saved presentations for the StartScreen: [{ id, title, slideCount, updatedAt, cover, theme }] */
  recentProjects: [],
  /**
   * Toasts (D62): [{ id, kind: 'success'|'error'|'info', title, description?, action?, duration }].
   * `action` is { label, onAction }.
   */
  toasts: [],
  /**
   * The one open modal (D62): { kind: 'confirm'|'prompt', title, description?, confirmLabel?,
   * destructive?, label?, placeholder?, defaultValue?, validate?, resolve } | null.
   */
  dialog: null,

  /** Show a toast; returns its id. Errors stay longer, and toasts with an action longer still. */
  toast: (t) => {
    const id = `toast${++toastSeq}`;
    const duration = t.duration ?? (t.action ? 6000 : t.kind === 'error' ? 6000 : 3500);
    set((s) => ({ toasts: [...s.toasts.slice(-2), { kind: 'info', ...t, id, duration }] }));
    return id;
  },
  dismissToast: (id) =>
    set((s) =>
      s.toasts.some((t) => t.id === id) ? { toasts: s.toasts.filter((t) => t.id !== id) } : s,
    ),
  /**
   * Open a modal and wait for the answer: confirm → true/false; prompt → the text or null.
   * A second request while one is open cancels the first.
   * @returns {Promise<boolean | string | null>}
   */
  openDialog: (spec) =>
    new Promise((resolve) =>
      set((s) => {
        s.dialog?.resolve(spec.kind === 'prompt' ? null : false);
        return { dialog: { ...spec, resolve } };
      }),
    ),
  closeDialog: (value) =>
    set((s) => {
      if (!s.dialog) return s;
      s.dialog.resolve(value);
      return { dialog: null };
    }),

  // The drawer lives in the right-hand panel, so opening it also shows that panel.
  openDrawer: (elementId) =>
    set((s) => ({
      drawer: { elementId },
      panels: s.panels.chat ? s.panels : { ...s.panels, chat: true },
    })),
  closeDrawer: () => set((s) => (s.drawer ? { drawer: null } : s)),
  setPrinting: (printing) => set({ printing }),
  setPresenting: (presenting) => set({ presenting }),
  setColorScheme: (colorScheme) =>
    set((s) => (s.colorScheme === colorScheme ? s : { colorScheme })),
  /** @param {'filmstrip'|'chat'} name @param {boolean} [open] toggles when omitted */
  setPanel: (name, open) =>
    set((s) => {
      const next = open ?? !s.panels[name];
      // Collapsing the right-hand panel also closes an editor that was shown in it.
      const drawer = name === 'chat' && !next ? null : s.drawer;
      return { panels: { ...s.panels, [name]: next }, drawer };
    }),
  setSideWidth: (w) =>
    set((s) => {
      const sideWidth = clampSide(w);
      return s.sideWidth === sideWidth ? s : { sideWidth };
    }),
  setScreen: (screen) => set((s) => (s.screen === screen ? s : { screen })),
  setRecentProjects: (recentProjects) => set({ recentProjects }),
  setSaveStatus: (saveStatus) => set((s) => (s.saveStatus === saveStatus ? s : { saveStatus })),

  select(id, additive = false) {
    set((s) => {
      // editingId is NOT cleared here: the editor's own blur commits and exits. Clearing it here
      // would unmount the editor before blur could save (spike gotcha 6).
      if (!id) return s.selection.length ? { selection: [] } : s;
      const hit = findElement(s.deck, id);
      if (!hit) return s;
      // A grouped element brings its whole group (D53).
      const unit = expandToGroups(hit.slide, [id]);
      if (!additive) return { selection: unit };
      // Additive selection stays within one slide, so a selection never spans slides.
      const base = s.selection.filter((eid) => hit.slide.elements[eid]);
      const on = unit.every((u) => base.includes(u));
      return {
        selection: on
          ? base.filter((x) => !unit.includes(x))
          : expandToGroups(hit.slide, [...base, ...unit]),
      };
    });
  },
  /** Replace the selection (box select, paste, duplicate); groups are completed. */
  setSelection: (ids) =>
    set((s) => {
      const hit = ids.length ? findElement(s.deck, ids[0]) : null;
      return { selection: hit ? expandToGroups(hit.slide, ids) : ids };
    }),
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
