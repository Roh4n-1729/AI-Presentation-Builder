import { clampBBox, findFreeSpot, searchFreeSpot } from './geometry.js';
import { DEFAULT_SIZES, LAYOUT_DEFS } from './layouts.js';

/** Text elements are placed by role, everything else by type. */
export const kindOf = (element) => (element.type === 'text' ? element.role : element.type);

const occupiedSlots = (slide, ignoreId) =>
  new Set(
    slide.elementOrder
      .filter((id) => id !== ignoreId)
      .map((id) => slide.elements[id].slot)
      .filter(Boolean),
  );

/**
 * Decide where a new element goes (D9, D24: callers resolve placement, applyOp only clamps).
 *   1. An explicit bbox without a preferred slot wins (clamped): the user or model chose a spot.
 *   2. Otherwise the preferred slot, or the first free slot whose `accepts` includes the kind.
 *   3. Otherwise the free spot nearest the requested position (or top-left) at the default size for
 *      the kind, shrinking to 75% then 50% before giving up and overlapping (slide is full).
 *
 * @param {import('../schema/deck.js').Slide} slide  slide the element will be added to
 * @param {{ type: string, role?: string, bbox?: import('../schema/elements.js').BBox }} element
 * @param {string} [preferredSlot]
 * @returns {{ bbox: import('../schema/elements.js').BBox, slot?: string }}
 */
export function placeElement(slide, element, preferredSlot) {
  if (element.bbox && !preferredSlot) return { bbox: clampBBox(element.bbox) };

  const kind = kindOf(element);
  const taken = occupiedSlots(slide);
  const fits = (s) => s.accepts.includes(kind) && !taken.has(s.name);
  const slots = LAYOUT_DEFS[slide.layout]?.slots ?? [];
  const slot = slots.find((s) => s.name === preferredSlot && fits(s)) ?? slots.find(fits);
  if (slot) return { bbox: { ...slot.bbox }, slot: slot.name };

  const size = element.bbox ?? DEFAULT_SIZES[kind] ?? DEFAULT_SIZES.body;
  const near = element.bbox ? { x: element.bbox.x, y: element.bbox.y } : undefined;
  for (const f of [1, 0.75, 0.5]) {
    const spot = searchFreeSpot(slide, { w: size.w * f, h: size.h * f }, near);
    if (spot) return { bbox: spot };
  }
  return { bbox: findFreeSpot(slide, { w: size.w, h: size.h }, near) };
}

/**
 * New boxes for `change_layout`. Only elements still in a slot move (hand-placed and locked ones
 * stay put); they take the new layout's slots in z-order, by kind. A slotted element with no
 * matching slot keeps its box and loses its slot.
 *
 * @param {import('../schema/deck.js').Slide} slide
 * @param {import('../schema/deck.js').Layout} layout
 * @returns {Record<string, { bbox: import('../schema/elements.js').BBox, slot: string | null }>}
 */
export function reflowLayout(slide, layout) {
  const slots = LAYOUT_DEFS[layout]?.slots ?? [];
  const taken = new Set();
  /** @type {Record<string, { bbox: any, slot: string | null }>} */
  const placements = {};
  for (const id of slide.elementOrder) {
    const el = slide.elements[id];
    if (!el.slot || el.locked) continue;
    const target = slots.find((s) => s.accepts.includes(kindOf(el)) && !taken.has(s.name));
    if (target) {
      taken.add(target.name);
      placements[id] = { bbox: { ...target.bbox }, slot: target.name };
    } else {
      placements[id] = { bbox: clampBBox(el.bbox), slot: null };
    }
  }
  return placements;
}
