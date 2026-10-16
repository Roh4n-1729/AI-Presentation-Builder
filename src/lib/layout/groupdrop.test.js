import { describe, expect, it } from 'vitest';
import { createSlide } from '../factories.js';
import { fitOnSlide, overlaps, shiftGroup, unionBox } from './index.js';

const a = { x: 100, y: 100, w: 400, h: 200 };
const b = { x: 300, y: 320, w: 300, h: 150 }; // 200 right, 220 down from a

describe('group drops (D54)', () => {
  it('moves as one piece and keeps the arrangement at an edge', () => {
    const [a2, b2] = shiftGroup([a, b], 1800, 0); // would run off the right edge
    expect(b2.x - a2.x).toBe(b.x - a.x);
    expect(b2.y - a2.y).toBe(b.y - a.y);
    expect(unionBox([a2, b2]).x + unionBox([a2, b2]).w).toBeLessThanOrEqual(1920);
  });

  it('lands in a free spot on a thumbnail drop, members keep their offsets', () => {
    const slide = createSlide({ id: 's_target1', layout: 'content' });
    slide.elements.el_block1 = {
      id: 'el_block1',
      type: 'shape',
      shape: 'rect',
      fill: 'accent',
      bbox: { x: 80, y: 80, w: 700, h: 500 },
    };
    slide.elementOrder.push('el_block1');
    const [a2, b2] = fitOnSlide(slide, [a, b]).boxes;
    expect(b2.x - a2.x).toBe(200);
    expect(b2.y - a2.y).toBe(220);
    for (const box of [a2, b2]) expect(overlaps(box, slide.elements.el_block1.bbox)).toBe(false);
  });
});

describe('making room on a full slide (D63)', () => {
  const fullSlide = () => {
    const slide = createSlide({ id: 's_full2', layout: 'content' });
    slide.elements.el_t = {
      id: 'el_t',
      type: 'text',
      role: 'title',
      bbox: { x: 96, y: 72, w: 1728, h: 150 },
      paragraphs: [{ text: 'Title' }],
      style: {},
    };
    slide.elements.el_body = {
      id: 'el_body',
      type: 'text',
      role: 'body',
      bbox: { x: 96, y: 250, w: 1728, h: 760 },
      paragraphs: [{ text: 'Bullets', bullet: true }],
      style: {},
    };
    slide.elementOrder.push('el_t', 'el_body');
    return slide;
  };
  const chart = { x: 96, y: 250, w: 1100, h: 740 };
  const after = (slide, fit) =>
    slide.elementOrder.map(
      (id) => fit.adjust.find((a) => a.id === id)?.bbox ?? slide.elements[id].bbox,
    );

  it('trims the element in the way instead of covering it; the title never moves', () => {
    const slide = fullSlide();
    const fit = fitOnSlide(slide, [chart]);
    expect(fit.how).toBe('room');
    const [box] = fit.boxes;
    for (const b of after(slide, fit)) expect(overlaps(box, b)).toBe(false);
    expect(fit.adjust.map((a) => a.id)).toEqual(['el_body']);
    expect(box.w / box.h).toBeCloseTo(1100 / 740, 1); // proportions kept
    expect(box.y).toBeGreaterThanOrEqual(72 + 150); // below the title
  });

  it('never trims a locked element; with nothing that can give way it lands on top', () => {
    const slide = fullSlide();
    slide.elements.el_body.locked = true;
    const fit = fitOnSlide(slide, [chart]);
    expect(fit.how).toBe('over');
    expect(fit.adjust).toEqual([]);
  });

  it('moves a group the same way, keeping its arrangement (scaled)', () => {
    const slide = fullSlide();
    const g = [
      { x: 100, y: 300, w: 600, h: 400 },
      { x: 720, y: 300, w: 400, h: 400 },
    ];
    const fit = fitOnSlide(slide, g);
    expect(fit.how).toBe('room');
    const [a2, b2] = fit.boxes;
    expect(b2.x - a2.x).toBeGreaterThan(0);
    expect(Math.abs(b2.y - a2.y)).toBeLessThanOrEqual(1);
    for (const box of fit.boxes)
      for (const b of after(slide, fit)) expect(overlaps(box, b)).toBe(false);
  });
});
