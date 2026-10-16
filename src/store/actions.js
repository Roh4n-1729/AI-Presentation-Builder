import {
  groupId as newGroupId,
  elementId as newElementId,
  slideId as newSlideId,
} from '../lib/ids.js';
import { groupState, remapGroups } from '../lib/groups.js';
import { findElement } from '../lib/ops/index.js';
import { createSlide } from '../lib/factories.js';
import { overlaps, placeElement } from '../lib/layout/index.js';
import { ARTBOARD_H, SAFE_MARGIN } from '../lib/constants.js';
import { tableBoxAt } from '../lib/tabular.js';

/*
 * Composite user actions: turn an intent into fully-resolved ops (fresh ids, concrete boxes),
 * then go through the one dispatch. Plain functions over a store, so keyboard shortcuts, toolbar
 * buttons and tests share them.
 */

/** @param {ReturnType<import('./index.js').createAppStore>} store */
/**
 * A "Deleted …" toast with Undo (D62). Undo reverts the deletion only while it is still the
 * newest history entry; after newer changes it says so instead of undoing something else.
 */
function deletedToast(store, res, title) {
  if (!res?.ok || !res.historyEntryId) return;
  store.getState().toast({
    kind: 'success',
    title,
    action: {
      label: 'Undo',
      onAction: () => {
        const s = store.getState();
        if (s.past.at(-1)?.id === res.historyEntryId && s.undo()) return;
        s.toast({
          kind: 'info',
          title: "Can't undo from here",
          description: 'Newer changes came after it. Use Ctrl+Z to step back through them.',
        });
      },
    },
  });
}

const KIND_NAMES = {
  text: 'text box',
  image: 'image',
  chart: 'chart',
  table: 'table',
  shape: 'shape',
};

/** Delete the selection. `quiet` skips the toast (cut, which says nothing either). */
export function deleteSelection(store, { quiet = false } = {}) {
  const { selection, deck, dispatch } = store.getState();
  if (!selection.length) return null;
  const n = selection.length;
  const one = n === 1 ? findElement(deck, selection[0])?.el : null;
  const res = dispatch(
    selection.map((id) => ({ type: 'delete_element', elementId: id })),
    { label: n > 1 ? `Delete ${n} elements` : 'Delete element' },
  );
  if (!quiet)
    deletedToast(
      store,
      res,
      one ? `Deleted ${KIND_NAMES[one.type] ?? 'element'}` : `Deleted ${n} elements`,
    );
  return res;
}

export function duplicateSelection(store) {
  const { selection, deck, dispatch, setSelection } = store.getState();
  if (!selection.length) return null;
  const els = selection.map((id) => findElement(deck, id).el);
  // Copies of grouped elements form their own new group, never join the original (D53).
  const groups = remapGroups(els, newGroupId);
  const ops = [];
  const newIds = [];
  for (const el of els) {
    const newId = newElementId();
    newIds.push(newId);
    ops.push({
      type: 'move_element',
      elementId: el.id,
      newId,
      bbox: { ...el.bbox, x: el.bbox.x + 40, y: el.bbox.y + 40 },
    });
    if (el.groupId)
      ops.push({
        type: 'update_element',
        elementId: newId,
        patch: { groupId: groups[el.groupId] },
      });
  }
  const res = dispatch(ops, { label: 'Duplicate' });
  if (res.ok) setSelection(newIds);
  return res;
}

/** Group the selection (2+ elements on one slide) under a new group id. One undo step. */
export function groupSelection(store) {
  const { selection, deck, dispatch } = store.getState();
  const hit = selection.length ? findElement(deck, selection[0]) : null;
  if (!hit || !groupState(hit.slide, selection).canGroup) return null;
  const groupId = newGroupId();
  return dispatch(
    selection.map((id) => ({ type: 'update_element', elementId: id, patch: { groupId } })),
    { label: 'Group' },
  );
}

/** Take every selected element out of its group. The selection stays as it was. */
export function ungroupSelection(store) {
  const { selection, deck, dispatch } = store.getState();
  const grouped = selection.filter((id) => findElement(deck, id)?.el.groupId);
  if (!grouped.length) return null;
  return dispatch(
    grouped.map((id) => ({ type: 'update_element', elementId: id, patch: { groupId: null } })),
    { label: 'Ungroup' },
  );
}

export function nudgeSelection(store, dx, dy) {
  const { selection, deck, dispatch } = store.getState();
  if (!selection.length) return null;
  return dispatch(
    selection.map((id) => {
      const { el } = findElement(deck, id);
      return {
        type: 'move_element',
        elementId: id,
        bbox: { ...el.bbox, x: el.bbox.x + dx, y: el.bbox.y + dy },
      };
    }),
    { label: 'Nudge' },
  );
}

/** Add a blank slide after `afterSlideId` (null = first). Returns the new slide id. */
export function addBlankSlide(store, afterSlideId) {
  const id = newSlideId();
  const res = store.getState().dispatch(
    {
      type: 'add_slide',
      slide: createSlide({ id, title: 'Untitled slide', layout: 'blank' }),
      afterSlideId,
    },
    { label: 'Add slide' },
  );
  return res.ok ? id : null;
}

export function duplicateSlide(store, slideId) {
  const { deck, dispatch } = store.getState();
  const slide = deck.slides[slideId];
  if (!slide) return null;
  const newId = newSlideId();
  const idMap = Object.fromEntries(slide.elementOrder.map((eid) => [eid, newElementId()]));
  const res = dispatch(
    { type: 'duplicate_slide', slideId, newSlideId: newId, idMap },
    { label: 'Duplicate slide' },
  );
  return res.ok ? newId : null;
}

export function deleteSlide(store, slideId) {
  const { deck, dispatch } = store.getState();
  const title = deck.slides[slideId]?.title;
  const res = dispatch({ type: 'delete_slide', slideId }, { label: 'Delete slide' });
  deletedToast(store, res, title ? `Deleted slide "${title}"` : 'Deleted slide');
  return res;
}

/**
 * Filmstrip drop: dnd-kit gives indices, the op wants an anchor (D24).
 * Moving `slideId` to position `toIndex` = "after the slide that will precede it".
 */
export function moveSlideToIndex(store, slideId, toIndex) {
  const { deck, dispatch } = store.getState();
  const rest = deck.slideOrder.filter((id) => id !== slideId);
  const afterSlideId = toIndex <= 0 ? null : rest[Math.min(toIndex, rest.length) - 1];
  return dispatch({ type: 'reorder_slides', slideId, afterSlideId }, { label: 'Reorder slides' });
}

export function renameSlide(store, slideId, title) {
  return store
    .getState()
    .dispatch({ type: 'update_slide', slideId, patch: { title } }, { label: 'Rename slide' });
}

/** Speaker notes for one slide (canvas notes field). Undoable like any edit. */
export function setSlideNotes(store, slideId, notes) {
  return store
    .getState()
    .dispatch({ type: 'update_slide', slideId, patch: { notes } }, { label: 'Edit speaker notes' });
}

/**
 * Insert a new element on the active slide (Insert menu, image upload). Placed like AI-added
 * content: into a free layout slot, else the nearest free spot. Selected afterwards.
 * @returns {string|null} new element id
 */
export function insertElement(store, partial, label = 'Insert') {
  const { deck, activeSlideId } = store.getState();
  const id = newElementId();
  const ops = [];
  let slideId = deck.slides[activeSlideId] ? activeSlideId : deck.slideOrder[0];
  let slide = slideId ? deck.slides[slideId] : null;
  // A box given with the element is a wish (centered image), not a command: never cover content.
  let placed = slide && placeElement(slide, partial, undefined, { avoidOverlap: true });
  const collides =
    placed && slide.elementOrder.some((eid) => overlaps(slide.elements[eid].bbox, placed.bbox));
  if (!slide || collides) {
    // No room on this slide (or no slide yet): put it on a new slide right after, so nothing is
    // covered. Same undo step as the insert itself.
    const newId = newSlideId();
    slide = createSlide({ id: newId, title: 'Untitled slide', layout: 'content' });
    ops.push({ type: 'add_slide', slide, afterSlideId: slideId ?? null });
    slideId = newId;
    placed = placeElement(slide, { ...partial, bbox: undefined });
  }
  const { slot } = placed;
  // A new table starts one row height per row, not the whole slot (D56).
  const bbox =
    partial.type === 'table'
      ? tableBoxAt(placed.bbox, partial.rows.length, ARTBOARD_H - SAFE_MARGIN)
      : placed.bbox;
  ops.push({
    type: 'add_element',
    slideId,
    element: { ...partial, id, bbox, ...(slot ? { slot } : {}) },
  });
  const res = store.getState().dispatch(ops, { label });
  if (!res.ok) return null;
  store.getState().setSelection([id]);
  store.getState().showInCanvas({ slideId, elementIds: [id], label });
  return id;
}

/** One-level patch to an element (style, chart, rows…), as one undo step. */
export function patchElement(store, elementId, patch, label = 'Edit') {
  return store.getState().dispatch({ type: 'update_element', elementId, patch }, { label });
}

/** Undo labels for z-order changes within a slide. */
const REORDER_LABELS = {
  forward: 'Bring forward',
  backward: 'Send backward',
  front: 'Bring to front',
  back: 'Send to back',
};

/** Layer order of one element: one step (`forward` / `backward`) or all the way (`front` / `back`). */
export function reorderElement(store, elementId, direction) {
  return store
    .getState()
    .dispatch(
      { type: 'reorder_elements', elementId, direction },
      { label: REORDER_LABELS[direction] },
    );
}
