import { z } from 'zod';
import { clampBBox } from '../layout/geometry.js';
import { ElementSchema } from '../schema/elements.js';
import { OpSchema } from '../schema/ops.js';
import { OpError } from './errors.js';
import {
  derivedElementId,
  findElement,
  insertAfter,
  removeId,
  requireElement,
  requireSlide,
} from './queries.js';

/**
 * THE single mutation path (D1). Canvas gestures, shortcuts, editors and AI tool calls all
 * produce ops; this applies one to a deck. It mutates its argument, which is an Immer draft in the
 * store (`produceWithPatches` turns the mutations into undo patches) or a throwaway working copy
 * on the server. It is deterministic: no clocks, no random ids, no layout decisions (D24).
 *
 * @param {import('../schema/deck.js').Deck} deck
 * @param {unknown} rawOp
 * @throws {OpError}
 */
export function applyOp(deck, rawOp) {
  const parsed = OpSchema.safeParse(rawOp);
  if (!parsed.success) throw new OpError('INVALID', z.prettifyError(parsed.error));
  const op = parsed.data;
  HANDLERS[op.type](deck, op);
}

/** Apply several ops in order (one dispatch = one history entry). Stops at the first error. */
export function applyOps(deck, ops) {
  for (const op of ops) applyOp(deck, op);
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Plain deep copy that also works on Immer drafts. */
const clone = (v) => JSON.parse(JSON.stringify(v));

/** Validate a whole element (after a merge or copy) and return it with schema defaults filled. */
function validElement(candidate) {
  const r = ElementSchema.safeParse(candidate);
  if (!r.success) throw new OpError('INVALID', z.prettifyError(r.error));
  return { ...r.data, bbox: clampBBox(r.data.bbox) };
}

function assertUnlocked(el) {
  if (el.locked) throw new OpError('LOCKED', `Element ${el.id} is locked`);
}

function assertNewElementId(deck, id) {
  if (findElement(deck, id)) throw new OpError('CONFLICT', `Element id ${id} already exists`);
}

// ---- handlers --------------------------------------------------------------------------------

const HANDLERS = {
  update_deck(deck, { patch }) {
    if (patch.title !== undefined) deck.title = patch.title;
    if (patch.theme !== undefined) deck.theme = patch.theme;
    if (patch.transition !== undefined) deck.transition = patch.transition;
  },

  add_slide(deck, { slide, afterSlideId }) {
    if (deck.slides[slide.id]) throw new OpError('CONFLICT', `Slide id ${slide.id} already exists`);
    for (const id of slide.elementOrder) assertNewElementId(deck, id);
    const copy = clone(slide);
    for (const id of copy.elementOrder) copy.elements[id].bbox = clampBBox(copy.elements[id].bbox);
    deck.slides[slide.id] = copy;
    insertAfter(deck.slideOrder, slide.id, afterSlideId);
  },

  update_slide(deck, { slideId, patch }) {
    const slide = requireSlide(deck, slideId);
    if (patch.title !== undefined) slide.title = patch.title;
    if (patch.notes !== undefined) slide.notes = patch.notes;
    if (patch.background) slide.background = { ...slide.background, ...patch.background };
  },

  delete_slide(deck, { slideId }) {
    requireSlide(deck, slideId);
    delete deck.slides[slideId];
    removeId(deck.slideOrder, slideId);
  },

  duplicate_slide(deck, { slideId, newSlideId, idMap = {}, afterSlideId }) {
    const src = requireSlide(deck, slideId);
    if (deck.slides[newSlideId])
      throw new OpError('CONFLICT', `Slide id ${newSlideId} already exists`);
    // Copy from THIS deck (D24): the server never ships slide content, so stripped image data
    // on its working copy can't leak into the client's copy.
    const copy = clone(src);
    copy.id = newSlideId;
    copy.elements = {};
    copy.elementOrder = src.elementOrder.map((oldId) => {
      const newId = idMap[oldId] ?? derivedElementId(oldId, newSlideId);
      assertNewElementId(deck, newId);
      copy.elements[newId] = { ...clone(src.elements[oldId]), id: newId };
      return newId;
    });
    deck.slides[newSlideId] = copy;
    insertAfter(deck.slideOrder, newSlideId, afterSlideId === undefined ? slideId : afterSlideId);
  },

  reorder_slides(deck, { slideId, afterSlideId }) {
    requireSlide(deck, slideId);
    if (afterSlideId === slideId) return;
    removeId(deck.slideOrder, slideId);
    insertAfter(deck.slideOrder, slideId, afterSlideId);
  },

  change_layout(deck, { slideId, layout, placements }) {
    const slide = requireSlide(deck, slideId);
    slide.layout = layout;
    for (const [id, { bbox, slot }] of Object.entries(placements)) {
      const el = slide.elements[id];
      // Skip anything gone, locked or hand-placed since the placements were computed (D9).
      if (!el || el.locked || !el.slot) continue;
      el.bbox = clampBBox(bbox);
      if (slot) el.slot = slot;
      else delete el.slot;
    }
  },

  add_element(deck, { slideId, element }) {
    const slide = requireSlide(deck, slideId);
    assertNewElementId(deck, element.id);
    slide.elements[element.id] = validElement(element);
    slide.elementOrder.push(element.id); // new elements go on top
  },

  update_element(deck, { elementId, patch }) {
    const { slide, el } = requireElement(deck, elementId);
    const keys = Object.keys(patch);
    // A locked element accepts only unlocking, and joining or leaving a group (neither moves it).
    if (el.locked && keys.some((k) => k !== 'locked' && k !== 'groupId')) assertUnlocked(el);
    if ('id' in patch || ('type' in patch && patch.type !== el.type)) {
      throw new OpError('INVALID', 'An element cannot change its id or type');
    }
    const next = clone(el);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) delete next[k];
      else next[k] = isPlainObject(v) && isPlainObject(next[k]) ? { ...next[k], ...v } : v;
    }
    // Resizing or moving by hand takes the element out of its layout slot (D9).
    if (patch.bbox && !('slot' in patch)) delete next.slot;
    slide.elements[elementId] = validElement(next);
  },

  delete_element(deck, { elementId }) {
    const { slide, el } = requireElement(deck, elementId);
    assertUnlocked(el);
    delete slide.elements[elementId];
    removeId(slide.elementOrder, elementId);
  },

  move_element(deck, { elementId, toSlideId, bbox, newId }) {
    const { slide: from, el } = requireElement(deck, elementId);
    const to = toSlideId ? requireSlide(deck, toSlideId) : from;
    const box = clampBBox(bbox);

    if (!newId) assertUnlocked(el); // copying a locked element is fine; moving it isn't

    if (to === from && !newId) {
      el.bbox = box;
      delete el.slot; // placed by hand (or by an explicit AI move)
      return;
    }
    if (newId) assertNewElementId(deck, newId);
    const moved = { ...clone(el), id: newId ?? el.id, bbox: box };
    delete moved.slot;
    if (!newId) {
      delete from.elements[el.id];
      removeId(from.elementOrder, el.id);
    }
    to.elements[moved.id] = moved;
    to.elementOrder.push(moved.id);
  },

  reorder_elements(deck, { elementId, direction }) {
    const { slide } = requireElement(deck, elementId);
    const order = slide.elementOrder;
    const i = order.indexOf(elementId);
    const target = {
      forward: Math.min(i + 1, order.length - 1),
      backward: Math.max(i - 1, 0),
      front: order.length - 1,
      back: 0,
    }[direction];
    if (target === i) return;
    order.splice(i, 1);
    order.splice(target, 0, elementId);
  },
};
