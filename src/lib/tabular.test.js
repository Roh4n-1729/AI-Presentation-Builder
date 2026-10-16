import { describe, expect, it } from 'vitest';
import {
  chartFromGrid,
  looksLikeGrid,
  parseGrid,
  parseNumber,
  pasteIntoRows,
  tableBoxAt,
  tableBoxFor,
  tableFromGrid,
} from './tabular.js';

describe('parseGrid (D53)', () => {
  it('reads spreadsheet copies (tabs) and CSV with quotes', () => {
    expect(parseGrid('Quarter\tRevenue\nQ1\t1,200\nQ2\t1,450\n')).toEqual([
      ['Quarter', 'Revenue'],
      ['Q1', '1,200'],
      ['Q2', '1,450'],
    ]);
    expect(parseGrid('name,note\n"Smith, J","said ""hi""\nthen left"\r\n')).toEqual([
      ['name', 'note'],
      ['Smith, J', 'said "hi"\nthen left'],
    ]);
    expect(parseGrid('a;b;c\n1;2,5;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2,5', '3'],
    ]);
  });

  it('tells a grid from a sentence', () => {
    expect(looksLikeGrid('Q1\t10')).toBe(true);
    expect(looksLikeGrid('a,b\n1,2')).toBe(true);
    expect(looksLikeGrid('Hello, world')).toBe(false);
    expect(looksLikeGrid('line one\nline two')).toBe(false);
  });

  it('parses spreadsheet numbers, not labels', () => {
    expect(parseNumber('1,200')).toBe(1200);
    expect(parseNumber('₹1,200')).toBe(1200);
    expect(parseNumber('$3.5')).toBe(3.5);
    expect(parseNumber('12%')).toBe(12);
    expect(parseNumber('(40)')).toBe(-40);
    expect(parseNumber('-7')).toBe(-7);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('Q1')).toBeNaN();
    expect(parseNumber('2026 plan')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });
});

describe('chartFromGrid', () => {
  it('categories down, series across, names from the header row', () => {
    const r = chartFromGrid(parseGrid('Quarter\t2025\t2026\nQ1\t1,200\t1,500\nQ2\t1,450\t1,900'));
    expect(r).toEqual({
      ok: true,
      categories: ['Q1', 'Q2'],
      series: [
        { name: '2025', values: [1200, 1450] },
        { name: '2026', values: [1500, 1900] },
      ],
    });
  });

  it('turns round data laid out across (labels on top, one row of numbers)', () => {
    const r = chartFromGrid(parseGrid('TAM\tSAM\tSOM\n12000\t180\t12'));
    expect(r.categories).toEqual(['TAM', 'SAM', 'SOM']);
    expect(r.series).toEqual([{ name: 'Series 1', values: [12000, 180, 12] }]);
  });

  it('numbers only: one series, numbered items; blanks count as 0', () => {
    const r = chartFromGrid([['4'], [''], ['9']]);
    expect(r.categories).toEqual(['Item 1', 'Item 2']);
    expect(r.series[0].values).toEqual([4, 9]);
    expect(
      chartFromGrid([
        ['a', 'b'],
        ['c', 'd'],
      ]).ok,
    ).toBe(false);
  });

  it('keeps within chart limits and says so', () => {
    const grid = Array.from({ length: 30 }, (_, i) => [`R${i}`, String(i)]);
    const r = chartFromGrid(grid);
    expect(r.categories).toHaveLength(24);
    expect(r.note).toContain('24');
  });
});

describe('tables', () => {
  it('pads ragged grids and caps size', () => {
    expect(tableFromGrid([['a', 'b'], ['c']])).toEqual([
      ['a', 'b'],
      ['c', ''],
    ]);
    expect(tableFromGrid(Array.from({ length: 30 }, () => ['x']))).toHaveLength(20);
  });

  it('pastes into a table from a cell, growing it', () => {
    const rows = [
      ['Plan', 'Price'],
      ['Starter', '$0'],
    ];
    expect(pasteIntoRows(rows, [['Team', '$12', '50 seats']], 1, 0)).toEqual([
      ['Plan', 'Price', ''],
      ['Team', '$12', '50 seats'],
    ]);
    expect(rows[1][0]).toBe('Starter'); // original untouched
  });
});

describe('table boxes (D56)', () => {
  const box = { x: 100, y: 300, w: 800, h: 256 }; // sized to 4 rows
  it('a box sized to its rows follows them', () => {
    expect(tableBoxFor(box, 4, 9, 1040).h).toBe(576);
    expect(tableBoxFor(box, 4, 2, 1040).h).toBe(128);
    expect(tableBoxFor(box, 4, 4, 1040)).toBe(box);
  });
  it('a stretched box keeps its height, grows when needed, stays above the margin', () => {
    const tall = { ...box, h: 420 };
    expect(tableBoxFor(tall, 4, 3, 1040)).toBe(tall);
    expect(tableBoxFor(tall, 4, 9, 1040).h).toBe(576);
    expect(tableBoxFor(tall, 4, 30, 1040).h).toBe(740);
  });
  it('a new table starts one row height per row', () => {
    expect(tableBoxAt({ ...box, h: 420 }, 3, 1040).h).toBe(192);
    expect(tableBoxAt({ ...box, y: 900 }, 6, 1040).h).toBe(140);
  });
});
