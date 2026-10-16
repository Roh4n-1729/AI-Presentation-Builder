import { describe, expect, it } from 'vitest';
import { isEmptySeries, legendAvailable, niceCeil, valueDomain, visibleSeries } from './chart.js';

const chart = (kind, series, categories = ['TAM', 'SAM', 'SOM']) => ({
  kind,
  categories,
  series,
});

describe('chart rules (D51)', () => {
  it('leaves empty series out of the drawing, keeps them if nothing else is left', () => {
    const c = chart('bar', [
      { name: 'Market size', values: [12000, 180, 12] },
      { name: 'Series 3', values: [0, 0, 0] },
      { name: 'Series 4', values: [] },
    ]);
    expect(isEmptySeries(c.series[1])).toBe(true);
    expect(visibleSeries(c).map((s) => s.name)).toEqual(['Market size']);
    expect(legendAvailable(c)).toBe(false); // one drawn series: the title names it
    const allEmpty = chart('bar', [{ name: 'A', values: [0, 0, 0] }]);
    expect(visibleSeries(allEmpty)).toHaveLength(1);
  });

  it('rounds axis ends to readable numbers', () => {
    expect(niceCeil(13440)).toBe(15000);
    expect(niceCeil(110)).toBe(120);
    expect(niceCeil(0.37)).toBe(0.4);
    expect(niceCeil(100)).toBe(100);
  });

  it('leaves headroom above the largest value (and below the smallest negative)', () => {
    const [lo, hi] = valueDomain(chart('bar', [{ name: 'M', values: [12000, 180, 12] }]));
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(12000);
    expect(hi).toBe(15000);
    const stacked = chart('stacked-bar', [
      { name: 'A', values: [60, 10, 5] },
      { name: 'B', values: [50, 10, 5] },
    ]);
    expect(valueDomain(stacked)[1]).toBe(150); // total 110 * 1.12 -> 150
    expect(valueDomain(chart('line', [{ name: 'P', values: [-40, 10, 20] }]))).toEqual([-50, 25]);
  });
});
