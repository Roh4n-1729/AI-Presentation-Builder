import { ARTBOARD_H, ARTBOARD_W, SAFE_MARGIN } from '../constants.js';
import { FIT_SCALES, overlaps, searchFreeSpot, shiftGroup, unionBox } from './geometry.js';
import { titleFloor } from './place.js';

/*
 * Putting one element, or a group, onto a slide that may already be full (D61, D63). Used when
 * there is no precise drop point: a filmstrip-thumbnail drop and the AI's move to another slide.
 *
 *   1. a free spot near the old position, at 100%, 75%, 50% or 35% of the size (D61);
 *   2. otherwise, make room: split the content area below the title into halves, fit the newcomer
 *      into one half, and narrow or shorten the elements in that half so they end where it
 *      begins (D63);
 *   3. otherwise (every option would hide or crush something), on top, clamped: the drop never fails.
 */

const GAP = 24;
/** The smallest an existing element may be trimmed to, by type (text and tables shrink their text). */
const MIN_SIZE = {
  text: { w: 240, h: 80 },
  chart: { w: 360, h: 240 },
  table: { w: 360, h: 132 },
  image: { w: 200, h: 140 },
  shape: { w: 40, h: 40 },
};
const TABLE_MIN_ROW = 44; // keep in step with TABLE_MIN_ROW_UNITS (lib/tabular.js, D56)

const minFor = (el) => {
  const m = MIN_SIZE[el.type] ?? MIN_SIZE.text;
  return el.type === 'table' ? { ...m, h: Math.max(m.h, el.rows.length * TABLE_MIN_ROW) } : m;
};

/** Lay `boxes` (keeping their arrangement) into `spot`, scaled by `k` from their union `u`. */
const scaleInto = (boxes, u, spot, k) =>
  boxes.map((b) => ({
    ...b,
    x: Math.round(spot.x + (b.x - u.x) * k),
    y: Math.round(spot.y + (b.y - u.y) * k),
    w: Math.round(b.w * k),
    h: Math.round(b.h * k),
  }));

/**
 * Halves of the content area (below the title, inside the safe margin), nearest to `near` first.
 * Each half says which way it cuts: elements on the far side keep their position and give up the
 * overlapping part along that axis.
 */
function halves(slide, near) {
  const top = Math.max(SAFE_MARGIN, titleFloor(slide, { type: 'chart' }));
  const left = SAFE_MARGIN;
  const right = ARTBOARD_W - SAFE_MARGIN;
  const bottom = ARTBOARD_H - SAFE_MARGIN;
  const midX = Math.round((left + right) / 2);
  const midY = Math.round((top + bottom) / 2);
  const list = [
    { side: 'right', x: midX + GAP / 2, y: top, w: right - midX - GAP / 2, h: bottom - top },
    { side: 'left', x: left, y: top, w: midX - left - GAP / 2, h: bottom - top },
    { side: 'bottom', x: left, y: midY + GAP / 2, w: right - left, h: bottom - midY - GAP / 2 },
    { side: 'top', x: left, y: top, w: right - left, h: midY - top - GAP / 2 },
  ];
  const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const d = (r) => (centre(r).x - near.x) ** 2 + (centre(r).y - near.y) ** 2;
  return list.filter((r) => r.h > 0 && r.w > 0).sort((a, b) => d(a) - d(b));
}

/**
 * Trim `b` so it no longer overlaps `spot`, cutting along the half's axis. Null when the element
 * can't give way: it isn't on the far side of the cut, or it would get too small.
 */
function trimAway(b, spot, side, min) {
  let next = null;
  if (side === 'right' && b.x < spot.x) next = { ...b, w: spot.x - GAP - b.x };
  else if (side === 'left' && b.x + b.w > spot.x + spot.w)
    next = { ...b, x: spot.x + spot.w + GAP, w: b.x + b.w - (spot.x + spot.w + GAP) };
  else if (side === 'bottom' && b.y < spot.y) next = { ...b, h: spot.y - GAP - b.y };
  else if (side === 'top' && b.y + b.h > spot.y + spot.h)
    next = { ...b, y: spot.y + spot.h + GAP, h: b.y + b.h - (spot.y + spot.h + GAP) };
  if (!next || next.w < min.w || next.h < min.h) return null;
  return next;
}

/**
 * Make room for something of `size` (D63): the best half of the content area, with the elements
 * in the way trimmed. Never moves or resizes the title, locked elements, or `ignoreId`.
 * @returns {{ spot: { x: number, y: number, w: number, h: number }, k: number,
 *   adjust: { id: string, bbox: object }[] } | null}  null when no half works
 */
export function makeRoom(slide, size, near, ignoreId) {
  let best = null;
  for (const half of halves(slide, near)) {
    const k = Math.min(1, half.w / size.w, half.h / size.h);
    if (k < FIT_SCALES.at(-1)) continue; // the newcomer would be too small to use
    const w = Math.round(size.w * k);
    const h = Math.round(size.h * k);
    // Top-left of the half, or centred across it when the half is much larger than needed.
    const spot = {
      x:
        half.side === 'top' || half.side === 'bottom'
          ? half.x + Math.round((half.w - w) / 2)
          : half.x,
      y: half.y,
      w,
      h,
    };
    const adjust = [];
    let lost = 0;
    let ok = true;
    for (const id of slide.elementOrder) {
      if (id === ignoreId) continue;
      const el = slide.elements[id];
      if (!overlaps(el.bbox, spot)) continue;
      const isTitle = el.type === 'text' && el.role === 'title';
      const next = !isTitle && !el.locked ? trimAway(el.bbox, spot, half.side, minFor(el)) : null;
      if (!next) {
        ok = false;
        break;
      }
      adjust.push({ id, bbox: next });
      lost += el.bbox.w * el.bbox.h - next.w * next.h;
    }
    // Trimmed elements must not now overlap each other's new boxes or the newcomer.
    if (
      ok &&
      adjust.every(
        (a) =>
          !overlaps(a.bbox, spot) &&
          slide.elementOrder.every(
            (id) =>
              id === a.id ||
              id === ignoreId ||
              !overlaps(
                a.bbox,
                (adjust.find((x) => x.id === id) ?? { bbox: slide.elements[id].bbox }).bbox,
              ),
          ),
      )
    ) {
      // Prefer the half that takes least from existing content, then the one nearest the drop.
      if (!best || lost < best.lost) best = { spot, k, adjust, lost };
    }
  }
  return best && { spot: best.spot, k: best.k, adjust: best.adjust };
}

/**
 * Where `boxes` (one element, or a group keeping its arrangement) go on `slide`, and which
 * existing elements give way. One call for thumbnail drops and the AI's cross-slide move.
 * @param {import('../schema/deck.js').Slide} slide  the target slide (without the moving elements)
 * @param {{ x: number, y: number, w: number, h: number }[]} boxes
 * @returns {{ boxes: object[], adjust: { id: string, bbox: object }[], how: 'free' | 'room' | 'over' }}
 */
export function fitOnSlide(slide, boxes, ignoreId) {
  const u = unionBox(boxes);
  const near = { x: u.x, y: u.y };
  for (const k of FIT_SCALES) {
    const spot = searchFreeSpot(slide, { w: u.w * k, h: u.h * k }, near, ignoreId);
    if (spot) return { boxes: scaleInto(boxes, u, spot, k), adjust: [], how: 'free' };
  }
  const room = makeRoom(slide, u, { x: u.x + u.w / 2, y: u.y + u.h / 2 }, ignoreId);
  if (room)
    return { boxes: scaleInto(boxes, u, room.spot, room.k), adjust: room.adjust, how: 'room' };
  return { boxes: shiftGroup(boxes, 0, 0), adjust: [], how: 'over' };
}
