import { elementId as newElementId, slideId as newSlideId } from '../lib/ids.js';
import { findElement } from '../lib/ops/index.js';
import { createSlide } from '../lib/factories.js';
import { overlaps, placeElement } from '../lib/layout/index.js';

/*
 * Composite user actions: turn an intent into fully-resolved ops (fresh ids, concrete boxes),
 * then go through the one dispatch. Plain functions over a store, so keyboard shortcuts, toolbar
 * buttons and tests share them.
 */

/** @param {ReturnType<import('./index.js').createAppStore>} store */
export function deleteSelection(store) {
  const { selection, dispatch } = store.getState();
  if (!selection.length) return null;
  return dispatch(
    selection.map((id) => ({ type: 'delete_element', elementId: id })),
    { label: selection.length > 1 ? `Delete ${selection.length} elements` : 'Delete element' },
  );
}

export function duplicateSelection(store) {
  const { selection, deck, dispatch, setSelection } = store.getState();
  if (!selection.length) return null;
  const ops = selection.map((id) => {
    const { el } = findElement(deck, id);
    return {
      type: 'move_element',
      elementId: id,
      newId: newElementId(),
      bbox: { ...el.bbox, x: el.bbox.x + 40, y: el.bbox.y + 40 },
    };
  });
  const res = dispatch(ops, { label: 'Duplicate' });
  if (res.ok) setSelection(ops.map((o) => o.newId));
  return res;
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
  return store.getState().dispatch({ type: 'delete_slide', slideId }, { label: 'Delete slide' });
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
  const { bbox, slot } = placed;
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

/** Bring to front / send to back (z-order within the slide). */
export function reorderElement(store, elementId, direction) {
  return store
    .getState()
    .dispatch(
      { type: 'reorder_elements', elementId, direction },
      { label: direction === 'front' ? 'Bring to front' : 'Send to back' },
    );
}
