import { describe, expect, it } from 'vitest';
import {
  COLOR_ROLES,
  getTheme,
  PICKABLE_THEMES,
  resolveColor,
  seriesColor,
  THEMES,
} from './index.js';

const theme = getTheme('paper');

describe('getTheme', () => {
  it('falls back to the default theme for unknown ids', () => {
    expect(getTheme('nope')).toBe(THEMES.paper);
    expect(getTheme(undefined)).toBe(THEMES.paper);
  });

  it('maps the retired Sand id to Sage (decks saved before D46 keep a light green theme)', () => {
    expect(getTheme('sand').id).toBe('sage');
    expect(getTheme('sand', 'dark').id).toBe('moss');
  });

  it('pickable themes look different in both modes (no two share a background)', () => {
    for (const scheme of ['light', 'dark']) {
      const bgs = PICKABLE_THEMES().map((t) => getTheme(t.id, scheme).colors.bg);
      expect(new Set(bgs).size).toBe(bgs.length);
    }
  });

  it('every theme defines every color role', () => {
    for (const t of Object.values(THEMES)) {
      expect(Object.keys(t.colors).sort()).toEqual([...COLOR_ROLES].sort());
    }
  });
});

describe('resolveColor', () => {
  it('resolves roles through the theme', () => {
    expect(resolveColor('accent', theme)).toBe('#4250d5');
  });

  it('passes hex overrides and transparent through', () => {
    expect(resolveColor('#ABCDEF', theme)).toBe('#ABCDEF');
    expect(resolveColor('#abc', theme)).toBe('#abc');
    expect(resolveColor('transparent', theme)).toBe('transparent');
  });

  it('falls back for unknown or missing values (bad model output must still render)', () => {
    expect(resolveColor('chartreuse', theme)).toBe(theme.colors.text);
    expect(resolveColor(undefined, theme, 'muted')).toBe(theme.colors.muted);
    expect(resolveColor('toString', theme)).toBe(theme.colors.text); // no prototype keys
  });
});

describe('seriesColor', () => {
  it('uses the palette in fixed order and honors overrides', () => {
    expect(seriesColor({}, 0, theme)).toBe(theme.chart[0]);
    expect(seriesColor(undefined, 1, theme)).toBe(theme.chart[1]);
    expect(seriesColor({ color: 'accent2' }, 0, theme)).toBe(theme.colors.accent2);
    expect(seriesColor({ color: '#112233' }, 3, theme)).toBe('#112233');
  });
});

describe('series colors (D72)', () => {
  it('palette slots follow the theme; roles, hex and automatic still work', async () => {
    const { seriesColor } = await import('./resolveColor.js');
    const paper = getTheme('paper');
    const sage = getTheme('sage');
    expect(seriesColor({ color: 'chart3' }, 0, paper)).toBe(paper.chart[2]);
    expect(seriesColor({ color: 'chart3' }, 0, sage)).toBe(sage.chart[2]);
    expect(seriesColor({ color: '#123456' }, 0, paper)).toBe('#123456');
    expect(seriesColor({ color: 'accent2' }, 0, paper)).toBe(paper.colors.accent2);
    expect(seriesColor({}, 1, paper)).toBe(paper.chart[1]);
  });
});
