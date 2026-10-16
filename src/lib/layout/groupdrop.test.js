import { describe, expect, it } from 'vitest';
import { createSlide } from '../factories.js';
import { groupToFreeSpot, overlaps, shiftGroup, unionBox } from './index.js';

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
    const [a2, b2] = groupToFreeSpot(slide, [a, b]);
    expect(b2.x - a2.x).toBe(200);
    expect(b2.y - a2.y).toBe(220);
    for (const box of [a2, b2]) expect(overlaps(box, slide.elements.el_block1.bbox)).toBe(false);
  });
});
