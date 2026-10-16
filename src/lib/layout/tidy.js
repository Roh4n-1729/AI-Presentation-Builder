import { ARTBOARD_H, SAFE_MARGIN } from '../constants.js';
import { overlaps, searchFreeSpot } from './geometry.js';
import { kindOf, minYFor } from './place.js';

/**
 * Tidy a slide (D53): move overlapping boxes apart. For decks made before the spacing rules
 * (D41), or after hand edits. What stays put: locked elements, groups (arranged on purpose) and
 * shapes (usually a background or accent meant to sit under other content). The title goes
 * first, then the rest bottom-to-top in z-order; anything that overlaps what's already placed
 * moves to the nearest free spot, shrinking a little only if it must.
 */

const MEANINGFUL = 0.04; // overlap smaller than 4% of the smaller box is a touch, not a clash
const SHRINK = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
const GAP = 24; // same breathing room as slot trimming (D41)

const area = (b) => b.w * b.h;
function overlapArea(a, b) {
  if (!overlaps(a, b)) return 0;
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w * h;
}
const clashes = (a, b) => overlapArea(a, b) > MEANINGFUL * Math.min(area(a), area(b));

const fixed = (el) => el.locked || el.groupId || el.type === 'shape';

/** Pairs of element ids that clash (shapes and same-group pairs don't count). */
export function findOverlaps(slide) {
  const ids = slide.elementOrder.filter((id) => slide.elements[id].type !== 'shape');
  const pairs = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = slide.elements[ids[i]];
      const b = slide.elements[ids[j]];
      if (a.groupId && a.groupId === b.groupId) continue;
      if (clashes(a.bbox, b.bbox)) pairs.push([a.id, b.id]);
    }
  return pairs;
}

/**
 * @param {import('../schema/deck.js').Slide} slide
 * @returns {{ ops: object[], moved: string[], stuck: string[] }}  move_element ops (one per
 *   moved element) and the ids that found no free room (left where they were)
 */
export function tidySlide(slide) {
  const placed = []; // boxes already settled, as a mini slide for the free-spot search
  const settle = (bbox, id) => placed.push({ id, bbox });
  const asSlide = () => ({
    elementOrder: placed.map((p) => p.id),
    elements: Object.fromEntries(placed.map((p) => [p.id, { bbox: p.bbox }])),
  });

  const order = slide.elementOrder.map((id) => slide.elements[id]);
  for (const el of order) if (fixed(el) && el.type !== 'shape') settle(el.bbox, el.id);
  const movable = order
    .filter((el) => !fixed(el))
    .sort((a, b) => (kindOf(b) === 'title') - (kindOf(a) === 'title')); // title first, stable

  const ops = [];
  const moved = [];
  const stuck = [];
  for (const el of movable) {
    if (!placed.some((p) => clashes(p.bbox, el.bbox))) {
      settle(el.bbox, el.id);
      continue;
    }
    // First choice: straight down, just below what it hits, same left edge (keeps columns
    // aligned with the title). Then the nearest free grid spot, shrinking if it must.
    let spot = null;
    let y = el.bbox.y;
    for (let guard = 0; guard < 20 && !spot; guard++) {
      const box = { ...el.bbox, y };
      const hit = placed.filter((p) => clashes(p.bbox, box));
      if (!hit.length) spot = box;
      else y = Math.max(...hit.map((p) => p.bbox.y + p.bbox.h)) + GAP;
      if (y + el.bbox.h > ARTBOARD_H - SAFE_MARGIN) break;
    }
    if (spot && spot.y === el.bbox.y) spot = null; // didn't move: it wasn't clashing that way
    for (const f of spot ? [] : SHRINK) {
      spot = searchFreeSpot(
        asSlide(),
        { w: Math.round(el.bbox.w * f), h: Math.round(el.bbox.h * f) },
        { x: el.bbox.x, y: el.bbox.y },
        undefined,
        minYFor(slide, kindOf(el)),
      );
      if (spot) break;
    }
    if (!spot) {
      stuck.push(el.id);
      settle(el.bbox, el.id);
      continue;
    }
    ops.push({ type: 'move_element', elementId: el.id, bbox: spot });
    moved.push(el.id);
    settle(spot, el.id);
  }
  return { ops, moved, stuck };
}
