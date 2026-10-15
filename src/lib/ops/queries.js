import { OpError } from './errors.js';

/**
 * Locate an element anywhere in the deck.
 * @param {import('../schema/deck.js').Deck} deck
 * @param {string} elementId
 * @returns {{ slide: import('../schema/deck.js').Slide, el: import('../schema/elements.js').Element } | null}
 */
export function findElement(deck, elementId) {
  for (const sid of deck.slideOrder) {
    const slide = deck.slides[sid];
    const el = slide?.elements[elementId];
    if (el) return { slide, el };
  }
  return null;
}

export function requireSlide(deck, slideId) {
  const slide = deck.slides[slideId];
  if (!slide) throw new OpError('NOT_FOUND', `No slide ${slideId}`);
  return slide;
}

export function requireElement(deck, elementId) {
  const hit = findElement(deck, elementId);
  if (!hit) throw new OpError('NOT_FOUND', `No element ${elementId}`);
  return hit;
}

/** Remove the first occurrence of `id` in place (splice keeps Immer patches narrow, D24). */
export function removeId(arr, id) {
  const i = arr.indexOf(id);
  if (i !== -1) arr.splice(i, 1);
  return i;
}

/**
 * Insert `id` after `afterId` (D24). null = first; undefined or an id that is gone = last.
 * Anchoring by id means a concurrent reorder by the user can't make the op land elsewhere.
 */
export function insertAfter(arr, id, afterId) {
  if (afterId === null) {
    arr.splice(0, 0, id);
    return;
  }
  const i = afterId === undefined ? -1 : arr.indexOf(afterId);
  if (i === -1) arr.push(id);
  else arr.splice(i + 1, 0, id);
}

/** Deterministic id for a copied element when the op didn't name one (same on server and client). */
export const derivedElementId = (oldId, newSlideId) => `${oldId}_${newSlideId.slice(2)}`;
