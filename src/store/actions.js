import { elementId as newElementId, slideId as newSlideId } from '../lib/ids.js';
import { findElement } from '../lib/ops/index.js';
import { createSlide } from '../lib/factories.js';

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
