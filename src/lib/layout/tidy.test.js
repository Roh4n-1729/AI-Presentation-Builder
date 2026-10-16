import { describe, expect, it } from 'vitest';
import { createSlide } from '../factories.js';
import { findOverlaps, tidySlide } from './tidy.js';
import { overlaps } from './geometry.js';

const text = (id, role, bbox, extra = {}) => ({
  id,
  type: 'text',
  role,
  bbox,
  paragraphs: [{ text: id }],
  style: {},
  ...extra,
});
function slideWith(...els) {
  const s = createSlide({ id: 's_tidy01', layout: 'content' });
  for (const el of els) {
    s.elements[el.id] = el;
    s.elementOrder.push(el.id);
  }
  return s;
}

describe('tidySlide (D53)', () => {
  it('moves overlapping content apart, title first, and nothing overlaps after', () => {
    const slide = slideWith(
      text('el_body1', 'body', { x: 120, y: 260, w: 800, h: 500 }),
      text('el_title', 'title', { x: 120, y: 120, w: 1600, h: 200 }), // overlaps the body
      text('el_body2', 'body', { x: 600, y: 400, w: 800, h: 400 }), // overlaps body1
    );
    expect(findOverlaps(slide)).toHaveLength(2); // title×body1, body1×body2
    const { ops, moved } = tidySlide(slide);
    expect(moved).not.toContain('el_title'); // the title keeps its place
    const after = structuredClone(slide);
    for (const op of ops) after.elements[op.elementId].bbox = op.bbox;
    expect(findOverlaps(after)).toEqual([]);
    const boxes = Object.values(after.elements).map((e) => e.bbox);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
  });

  it('leaves locked, grouped and shape elements where they are; touches are fine', () => {
    const slide = slideWith(
      {
        id: 'el_bg001',
        type: 'shape',
        shape: 'rect',
        fill: 'surface',
        bbox: { x: 0, y: 0, w: 1920, h: 1080 },
      },
      text('el_lock1', 'body', { x: 200, y: 300, w: 600, h: 300 }, { locked: true }),
      text('el_grpa1', 'body', { x: 1000, y: 300, w: 400, h: 200 }, { groupId: 'g_aaaa1' }),
      text('el_grpb1', 'caption', { x: 1100, y: 450, w: 400, h: 100 }, { groupId: 'g_aaaa1' }),
      text('el_touch', 'body', { x: 800, y: 300, w: 190, h: 200 }), // edge-to-edge with the locked box
      text('el_clash', 'body', { x: 300, y: 350, w: 400, h: 200 }), // inside the locked box
    );
    const { moved } = tidySlide(slide);
    expect(moved).toEqual(['el_clash']);
    expect(findOverlaps(slide).some(([a, b]) => a === 'el_grpa1' && b === 'el_grpb1')).toBe(false);
  });
});
