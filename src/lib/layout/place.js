import { clampBBox, findFreeSpot, overlaps, searchFreeSpot } from './geometry.js';
import { CONTENT_TOP, DEFAULT_SIZES, LAYOUT_DEFS } from './layouts.js';

/** Text elements are placed by role, everything else by type. */
export const kindOf = (element) => (element.type === 'text' ? element.role : element.type);

const occupiedSlots = (slide, ignoreId) =>
  new Set(
    slide.elementOrder
      .filter((id) => id !== ignoreId)
      .map((id) => slide.elements[id].slot)
      .filter(Boolean),
  );

const NO_TITLE_BAND = new Set(['blank', 'title', 'section']);
/** Auto-placed non-title content never goes into the title band (above the content area). */
const minYFor = (slide, kind) =>
  kind === 'title' || NO_TITLE_BAND.has(slide.layout) ? 0 : CONTENT_TOP;

const GAP = 24; // breathing room kept between a slot's content and an element already there
const MIN_SLOT_H = 120; // a slot squeezed below this is treated as taken

/**
 * The part of a slot that is actually free (D41). Elements already on the slide (placed by hand,
 * by the AI with coordinates, or in an overlapping slot) take vertical bands out of it; the
 * largest free band that remains is used. Null when too little is left.
 */
export function freePartOfSlot(slide, box, ignoreId) {
  const blockers = slide.elementOrder
    .filter((id) => id !== ignoreId)
    .map((id) => slide.elements[id].bbox)
    .filter((b) => overlaps(b, box));
  if (!blockers.length) return box;
  let free = [[box.y, box.y + box.h]];
  for (const b of blockers) {
    const [top, bottom] = [b.y - GAP, b.y + b.h + GAP];
    free = free.flatMap(([a, z]) =>
      bottom <= a || top >= z
        ? [[a, z]]
        : [
            [a, top],
            [bottom, z],
          ].filter(([p, q]) => q - p > 0),
    );
  }
  const [a, z] = free.reduce((best, r) => (r[1] - r[0] > best[1] - best[0] ? r : best), [0, 0]);
  return z - a >= MIN_SLOT_H ? { ...box, y: Math.round(a), h: Math.round(z - a) } : null;
}

/**
 * Decide where a new element goes (D9, D24: callers resolve placement, applyOp only clamps).
 *   1. An explicit bbox without a preferred slot wins (clamped): the user or model chose a spot.
 *      With `avoidOverlap` (AI tools), a box that collides moves to the nearest free spot.
 *   2. Otherwise the preferred slot, or the first free slot whose `accepts` includes the kind,
 *      trimmed to the part not covered by elements already there (freePartOfSlot).
 *   3. Otherwise the free spot nearest the requested position (or top-left) at the default size for
 *      the kind, shrinking to 75% then 50% before giving up and overlapping (slide is full).
 *
 * @param {import('../schema/deck.js').Slide} slide  slide the element will be added to
 * @param {{ type: string, role?: string, bbox?: import('../schema/elements.js').BBox }} element
 * @param {string} [preferredSlot]
 * @param {{ avoidOverlap?: boolean }} [opts]  move colliding explicit boxes (AI tools set this)
 * @returns {{ bbox: import('../schema/elements.js').BBox, slot?: string }}
 */
export function placeElement(slide, element, preferredSlot, { avoidOverlap = false } = {}) {
  if (element.bbox && !preferredSlot) {
    const box = clampBBox(element.bbox);
    const others = slide.elementOrder.map((id) => slide.elements[id].bbox);
    // AI-supplied coordinates that collide with existing content: keep the size, move it to the
    // nearest free spot (or fall through to slots). A person's explicit placement is kept as is.
    if (!avoidOverlap || !others.some((o) => overlaps(o, box))) return { bbox: box };
    const spot = searchFreeSpot(slide, box, box, undefined, minYFor(slide, kindOf(element)));
    if (spot) return { bbox: spot };
  }

  const kind = kindOf(element);
  const taken = occupiedSlots(slide);
  const fits = (s) => s.accepts.includes(kind) && !taken.has(s.name);
  const slots = LAYOUT_DEFS[slide.layout]?.slots ?? [];
  const ordered = [...slots.filter((s) => s.name === preferredSlot), ...slots].filter(fits);
  for (const slot of ordered) {
    const bbox = freePartOfSlot(slide, slot.bbox);
    if (bbox) return { bbox: { ...bbox }, slot: slot.name };
  }

  const size = element.bbox ?? DEFAULT_SIZES[kind] ?? DEFAULT_SIZES.body;
  const near = element.bbox ? { x: element.bbox.x, y: element.bbox.y } : undefined;
  const minY = minYFor(slide, kind);
  for (const f of [1, 0.75, 0.5]) {
    const spot = searchFreeSpot(slide, { w: size.w * f, h: size.h * f }, near, undefined, minY);
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
