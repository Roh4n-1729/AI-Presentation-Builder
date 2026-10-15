import { enablePatches, produceWithPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyOp } from '../lib/ops/index.js';
import { makeDeck } from '../lib/test-fixtures.js';
import { revealTarget, touchedIds } from './affected.js';

enablePatches();
const patchesOf = (deck, op) => produceWithPatches(deck, (d) => applyOp(d, op));

describe('touchedIds', () => {
  it('finds the element and slide of an element edit', () => {
    const [, p] = patchesOf(makeDeck(), {
      type: 'move_element',
      elementId: 'el_chart',
      bbox: { x: 300, y: 300, w: 400, h: 300 },
    });
    expect(touchedIds(p)).toEqual({ slideIds: ['s_bbbbb'], elementIds: ['el_chart'] });
  });

  it('finds both slides of a cross-slide move', () => {
    const [, p] = patchesOf(makeDeck(), {
      type: 'move_element',
      elementId: 'el_chart',
      toSlideId: 's_aaaaa',
      bbox: { x: 40, y: 40, w: 400, h: 300 },
    });
    const t = touchedIds(p);
    expect(t.slideIds.sort()).toEqual(['s_aaaaa', 's_bbbbb']);
    expect(t.elementIds).toContain('el_chart');
  });

  it('finds the slide of a reorder via slideOrder values', () => {
    const [, p] = patchesOf(makeDeck(), {
      type: 'reorder_slides',
      slideId: 's_ccccc',
      afterSlideId: null,
    });
    expect(touchedIds(p).slideIds).toContain('s_ccccc');
  });
});

describe('revealTarget', () => {
  it('after undoing a cross-slide move, points at the element on its original slide', () => {
    const deck = makeDeck();
    const [moved, p, inv] = patchesOf(deck, {
      type: 'move_element',
      elementId: 'el_chart',
      toSlideId: 's_aaaaa',
      bbox: { x: 40, y: 40, w: 400, h: 300 },
    });
    expect(revealTarget(moved, [p, inv])).toEqual({ slideId: 's_aaaaa', elementIds: ['el_chart'] }); // redo view
    expect(revealTarget(deck, [p, inv])).toEqual({ slideId: 's_bbbbb', elementIds: ['el_chart'] }); // undo view
  });

  it('after undoing an add, the element is gone: points at its slide', () => {
    const deck = makeDeck();
    const [, p, inv] = patchesOf(deck, {
      type: 'add_element',
      slideId: 's_ccccc',
      element: {
        id: 'el_new01',
        type: 'shape',
        shape: 'rect',
        bbox: { x: 10, y: 10, w: 100, h: 100 },
      },
    });
    expect(revealTarget(deck, [p, inv])).toEqual({ slideId: 's_ccccc', elementIds: [] });
  });
});
