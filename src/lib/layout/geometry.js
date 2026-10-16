import { ARTBOARD_H, ARTBOARD_W, MIN_SIZE, PLACEMENT_GRID, SAFE_MARGIN } from '../constants.js';

/**
 * Shrink a box to fit the artboard (minus the safe margin), then push it fully inside.
 * Never fails: a huge chart dropped on a title slide still lands, just smaller (brief requirement).
 *
 * @param {import('../schema/elements.js').BBox} bbox
 * @returns {import('../schema/elements.js').BBox}
 */
export function clampBBox(bbox) {
  const w = Math.max(MIN_SIZE, Math.min(bbox.w, ARTBOARD_W - SAFE_MARGIN * 2));
  const h = Math.max(MIN_SIZE, Math.min(bbox.h, ARTBOARD_H - SAFE_MARGIN * 2));
  const x = Math.min(Math.max(bbox.x, 0), ARTBOARD_W - w);
  const y = Math.min(Math.max(bbox.y, 0), ARTBOARD_H - h);
  const out = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  if (bbox.rotation) out.rotation = bbox.rotation;
  return out;
}

/** Strict overlap: boxes that only touch edges don't overlap. */
export const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Collision-aware search: the free spot (no overlap with other elements) closest to `near`,
 * on a 40-unit grid inside the safe margin. Without `near`, scans top-left first.
 * Returns null when nothing is free.
 *
 * @param {import('../schema/deck.js').Slide} slide
 * @param {{ w: number, h: number }} size
 * @param {{ x: number, y: number }} [near]  preferred top-left corner
 * @param {string} [ignoreId]  element to ignore (the one being moved)
 * @param {number} [minY]  don't place above this line (keeps content out of the title band)
 */
export function searchFreeSpot(slide, size, near, ignoreId, minY = 0) {
  const box = clampBBox({ x: 0, y: 0, ...size });
  const others = slide.elementOrder
    .filter((id) => id !== ignoreId)
    .map((id) => slide.elements[id].bbox);

  const candidates = [];
  for (
    let y = Math.max(SAFE_MARGIN, minY);
    y + box.h <= ARTBOARD_H - SAFE_MARGIN;
    y += PLACEMENT_GRID
  ) {
    for (let x = SAFE_MARGIN; x + box.w <= ARTBOARD_W - SAFE_MARGIN; x += PLACEMENT_GRID) {
      candidates.push({ x, y });
    }
  }
  if (near) {
    const d = (p) => (p.x - near.x) ** 2 + (p.y - near.y) ** 2;
    candidates.sort((a, b) => d(a) - d(b)); // stable: ties keep top-left-first order
  }
  for (const p of candidates) {
    const candidate = { ...box, ...p };
    if (!others.some((o) => overlaps(candidate, o))) return candidate;
  }
  return null;
}

/** Sizes tried, in order, when looking for room on a slide (D31, D61). */
export const FIT_SCALES = [1, 0.75, 0.5, 0.35];

/**
 * Like searchFreeSpot, but never fails. Used for thumbnail drops, paste and the AI's move to
 * another slide. The element keeps its size if a free spot exists; otherwise it shrinks, keeping
 * its proportions, to 75%, 50% and then 35% (D61); only if even that doesn't fit does it fall back
 * to `near` (or the center) at full size, clamped, on top of what's there, as the brief asks
 * ("clamp rather than fail").
 */
export function findFreeSpot(slide, size, near, ignoreId) {
  for (const k of FIT_SCALES) {
    const spot = searchFreeSpot(
      slide,
      { w: Math.round(size.w * k), h: Math.round(size.h * k) },
      near,
      ignoreId,
    );
    if (spot) return spot;
  }
  const box = clampBBox({ x: 0, y: 0, ...size });
  const fallback = near ?? { x: (ARTBOARD_W - box.w) / 2, y: (ARTBOARD_H - box.h) / 2 };
  return clampBBox({ ...box, ...fallback });
}

/** The smallest box around `boxes`. */
export function unionBox(boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bottom - y };
}

/**
 * Move several boxes by (dx, dy) as one piece, then shift the piece (not each box) back inside
 * the artboard, so a group dropped near an edge keeps its arrangement instead of having its
 * members clamped one by one (D54). Boxes larger than the artboard are left to clampBBox.
 */
export function shiftGroup(boxes, dx, dy) {
  const moved = boxes.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy }));
  const u = unionBox(moved);
  const fx = Math.min(Math.max(u.x, 0), Math.max(0, ARTBOARD_W - u.w)) - u.x;
  const fy = Math.min(Math.max(u.y, 0), Math.max(0, ARTBOARD_H - u.h)) - u.y;
  return moved.map((b) => ({ ...b, x: Math.round(b.x + fx), y: Math.round(b.y + fy) }));
}
