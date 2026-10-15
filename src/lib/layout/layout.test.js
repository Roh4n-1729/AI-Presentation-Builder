import { describe, expect, it } from 'vitest';
import { ARTBOARD_H, ARTBOARD_W, SAFE_MARGIN } from '../constants.js';
import { createSlide } from '../factories.js';
import { makeDeck, text } from '../test-fixtures.js';
import {
  clampBBox,
  findFreeSpot,
  LAYOUT_DEFS,
  overlaps,
  placeElement,
  reflowLayout,
} from './index.js';

const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= ARTBOARD_W && b.y + b.h <= ARTBOARD_H;

describe('clampBBox', () => {
  it('leaves a box that already fits alone (rounded)', () => {
    expect(clampBBox({ x: 100.4, y: 200.6, w: 300, h: 150 })).toEqual({
      x: 100,
      y: 201,
      w: 300,
      h: 150,
    });
  });

  it('pushes off-artboard boxes back inside and shrinks oversized ones', () => {
    expect(inside(clampBBox({ x: -500, y: 2000, w: 400, h: 300 }))).toBe(true);
    const huge = clampBBox({ x: 0, y: 0, w: 5000, h: 5000 });
    expect(huge.w).toBe(ARTBOARD_W - SAFE_MARGIN * 2);
    expect(huge.h).toBe(ARTBOARD_H - SAFE_MARGIN * 2);
  });

  it('keeps rotation and enforces a minimum size', () => {
    expect(clampBBox({ x: 0, y: 0, w: 1, h: 1, rotation: 15 })).toMatchObject({
      w: 24,
      h: 24,
      rotation: 15,
    });
  });
});

describe('findFreeSpot', () => {
  const slide = makeDeck().slides.s_bbbbb; // chart left, body right

  it('never overlaps existing elements', () => {
    const spot = findFreeSpot(slide, { w: 300, h: 200 });
    for (const id of slide.elementOrder)
      expect(overlaps(spot, slide.elements[id].bbox)).toBe(false);
    expect(inside(spot)).toBe(true);
  });

  it('prefers the free spot nearest the requested position', () => {
    const empty = createSlide({ id: 's_empty' });
    expect(findFreeSpot(empty, { w: 300, h: 200 }, { x: 1000, y: 600 })).toMatchObject({
      x: 1000,
      y: 600,
    });
    const nearChart = findFreeSpot(slide, { w: 300, h: 200 }, { x: 500, y: 500 }); // inside the chart
    expect(overlaps(nearChart, slide.elements.el_chart.bbox)).toBe(false);
  });

  it('falls back to the requested spot (clamped) when the slide is full', () => {
    const full = createSlide({ id: 's_full1' });
    full.elements.el_bg = text('el_bg', { bbox: { x: 0, y: 0, w: 1920, h: 1080 } });
    full.elementOrder.push('el_bg');
    expect(findFreeSpot(full, { w: 400, h: 300 }, { x: 1800, y: 900 })).toEqual({
      x: 1520,
      y: 780,
      w: 400,
      h: 300,
    });
  });

  it('ignores the element being moved', () => {
    const spot = findFreeSpot(slide, { w: 1100, h: 740 }, { x: 96, y: 250 }, 'el_chart');
    expect(spot).toMatchObject({ x: 80, y: 240 }); // nearest grid point to its own old place
  });
});

describe('placeElement (slots, D9)', () => {
  const deck = makeDeck();

  it('fills the first free slot that accepts the kind', () => {
    const slide = createSlide({ id: 's_new01', layout: 'chart-focus' });
    expect(placeElement(slide, { type: 'chart' })).toEqual({
      bbox: LAYOUT_DEFS['chart-focus'].slots[1].bbox,
      slot: 'visual',
    });
    expect(placeElement(slide, { type: 'text', role: 'title' }).slot).toBe('title');
  });

  it('skips occupied slots, then finds free space, shrinking if needed', () => {
    const slide = createSlide({ id: 's_new03', layout: 'chart-focus' });
    slide.elements.el_c1 = { ...deck.slides.s_bbbbb.elements.el_chart, id: 'el_c1' }; // fills 'visual'
    slide.elementOrder.push('el_c1');
    const second = placeElement(slide, { type: 'chart' });
    expect(second.slot).toBeUndefined();
    expect(overlaps(second.bbox, slide.elements.el_c1.bbox)).toBe(false);
    expect(second.bbox.w).toBeLessThan(1000); // only ~680 units free on the right
    expect(inside(second.bbox)).toBe(true);
  });

  it('on a genuinely full slide it still lands inside the artboard', () => {
    const full = placeElement(deck.slides.s_bbbbb, { type: 'chart' });
    expect(inside(full.bbox)).toBe(true);
  });

  it('honors a preferred slot, and an explicit bbox over any slot', () => {
    const slide = createSlide({ id: 's_new02', layout: 'two-column' });
    expect(placeElement(slide, { type: 'chart' }, 'right').slot).toBe('right');
    expect(placeElement(slide, { type: 'chart', bbox: { x: 10, y: 10, w: 500, h: 400 } })).toEqual({
      bbox: { x: 10, y: 10, w: 500, h: 400 },
    });
  });

  it('every slot of every layout lies inside the artboard', () => {
    for (const def of Object.values(LAYOUT_DEFS))
      for (const s of def.slots) expect(inside(s.bbox)).toBe(true);
  });
});

describe('reflowLayout (change_layout)', () => {
  it('moves slotted elements into the new layout and leaves hand-placed ones alone', () => {
    const slide = structuredClone(makeDeck().slides.s_bbbbb);
    delete slide.elements.el_body.slot; // the user dragged the body text
    const placements = reflowLayout(slide, 'two-column');
    expect(placements).toEqual({
      el_chart: { bbox: LAYOUT_DEFS['two-column'].slots[1].bbox, slot: 'left' },
    });
  });

  it('skips locked elements and drops the slot when nothing matches', () => {
    const slide = structuredClone(makeDeck().slides.s_bbbbb);
    slide.elements.el_chart.locked = true;
    const placements = reflowLayout(slide, 'title'); // title layout has no slot for body text
    expect(placements.el_chart).toBeUndefined();
    expect(placements.el_body.slot).toBe('subtitle'); // subtitle slot accepts body
    expect(reflowLayout(slide, 'blank').el_body.slot).toBeNull();
  });
});
