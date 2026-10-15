import { describe, expect, it } from 'vitest';
import { makeDeck } from '../test-fixtures.js';
import { DeckSchema, ElementSchema, OP_TYPES, OpSchema } from './index.js';

describe('DeckSchema', () => {
  it('accepts the fixture deck and fills defaults', () => {
    const parsed = DeckSchema.parse(makeDeck());
    expect(parsed.theme).toBe('paper');
    expect(parsed.slides.s_bbbbb.elements.el_chart.chart.showLegend).toBe(true);
  });

  it('rejects order arrays that disagree with the maps', () => {
    const deck = makeDeck();
    deck.slideOrder.push('s_ghost');
    expect(DeckSchema.safeParse(deck).success).toBe(false);

    const deck2 = makeDeck();
    deck2.slides.s_bbbbb.elementOrder.pop();
    expect(DeckSchema.safeParse(deck2).success).toBe(false);
  });
});

describe('ElementSchema', () => {
  const chart = makeDeck().slides.s_bbbbb.elements.el_chart;

  it('requires one value per category in every series', () => {
    const bad = { ...chart, chart: { ...chart.chart, series: [{ name: 'x', values: [1, 2] }] } };
    const r = ElementSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error.issues)).toContain('one value per category');
  });

  it('requires rectangular tables', () => {
    const table = { id: 'el_t1', type: 'table', bbox: chart.bbox, rows: [['a', 'b'], ['c']] };
    expect(ElementSchema.safeParse(table).success).toBe(false);
  });

  it('rejects non-finite numbers (z.number() does this by default in Zod 4)', () => {
    expect(
      ElementSchema.safeParse({ ...chart, bbox: { ...chart.bbox, x: Infinity } }).success,
    ).toBe(false);
    expect(ElementSchema.safeParse({ ...chart, bbox: { ...chart.bbox, w: NaN } }).success).toBe(
      false,
    );
  });

  it('rejects unknown element types and malformed ids', () => {
    expect(ElementSchema.safeParse({ ...chart, type: 'video' }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...chart, id: 'chart-1' }).success).toBe(false);
  });
});

describe('OpSchema', () => {
  it('covers the op language from D24', () => {
    expect(OP_TYPES.sort()).toEqual(
      [
        'add_element',
        'add_slide',
        'change_layout',
        'delete_element',
        'delete_slide',
        'duplicate_slide',
        'move_element',
        'reorder_elements',
        'reorder_slides',
        'update_deck',
        'update_element',
        'update_slide',
      ].sort(),
    );
  });

  it('has no index-based positions', () => {
    const r = OpSchema.safeParse({ type: 'reorder_slides', from: 0, to: 2 });
    expect(r.success).toBe(false);
  });
});
