import { describe, expect, it } from 'vitest';
import { COLOR_ROLES, getTheme, resolveColor, seriesColor, THEMES } from './index.js';

const theme = getTheme('paper');

describe('getTheme', () => {
  it('falls back to the default theme for unknown ids', () => {
    expect(getTheme('nope')).toBe(THEMES.paper);
    expect(getTheme(undefined)).toBe(THEMES.paper);
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
