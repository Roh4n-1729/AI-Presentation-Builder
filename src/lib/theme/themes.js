/**
 * Slide themes (D17). Elements store colors as ROLES ('text', 'accent', …) and the renderer,
 * thumbnails, print view and PPTX export resolve them through the deck's theme. Switching the
 * theme therefore restyles a deck without touching content or positions. A literal hex is
 * allowed as an override.
 *
 * Type sizes are artboard units (1920×1080). Font size in units ÷ 2 = points in PowerPoint.
 */

/**
 * @typedef {Object} SlideTheme
 * @property {string} id
 * @property {string} name
 * @property {Record<ColorRole, string>} colors
 * @property {{ heading: string, body: string, mono: string }} fonts  CSS font-family stacks
 * @property {{ title: number, subtitle: number, body: number, caption: number, min: number }} type
 * @property {{ heading: number, body: number }} lineHeight
 * @property {string[]} chart  categorical series colors, assigned in this fixed order
 * @property {string} [dark]   id of the theme to display in the editor's dark mode (D40)
 */

/** @typedef {'bg'|'surface'|'text'|'muted'|'border'|'accent'|'accent2'|'onAccent'|'positive'|'negative'} ColorRole */

/** @type {Record<string, SlideTheme>} */
export const THEMES = {
  paper: {
    id: 'paper',
    name: 'Paper',
    dark: 'ink',
    colors: {
      bg: '#ffffff',
      surface: '#f5f6f8',
      text: '#16161a',
      muted: '#5c5f6a',
      border: '#e3e4e8',
      accent: '#4250d5',
      accent2: '#e96c2f',
      onAccent: '#ffffff',
      positive: '#1f8a4c',
      negative: '#c73a3a',
    },
    fonts: {
      heading: "'Instrument Serif', Georgia, serif",
      body: "'Geist', 'Segoe UI', system-ui, sans-serif",
      mono: "'Geist Mono', ui-monospace, monospace",
    },
    type: { title: 72, subtitle: 44, body: 34, caption: 24, min: 22 },
    lineHeight: { heading: 1.05, body: 1.3 },
    // Indigo, saffron, teal, violet, ochre, rose. Validated on #ffffff with the dataviz palette
    // checker: lightness band, chroma floor, CVD separation (worst adjacent ΔE 13.2),
    // normal-vision floor (21.5) and ≥ 3:1 contrast all pass.
    chart: ['#4250d5', '#e96c2f', '#16a3a3', '#8b5cf6', '#b98500', '#d0457d'],
  },
  // Paper's dark counterpart, shown while the editor is in dark mode (D40). Same roles, fonts and
  // sizes; only colors differ, so a deck looks the same in both apart from the palette.
  ink: {
    id: 'ink',
    name: 'Ink',
    hidden: true, // display-only dark variant of Paper/Sand; not offered in the theme picker
    colors: {
      bg: '#17171c',
      surface: '#212128',
      text: '#ededf0',
      muted: '#a3a4ad',
      border: '#33343c',
      accent: '#7b86f0',
      accent2: '#f08a52',
      onAccent: '#ffffff',
      positive: '#4cc27e',
      negative: '#f06a6a',
    },
    fonts: {
      heading: "'Instrument Serif', Georgia, serif",
      body: "'Geist', 'Segoe UI', system-ui, sans-serif",
      mono: "'Geist Mono', ui-monospace, monospace",
    },
    type: { title: 72, subtitle: 44, body: 34, caption: 24, min: 22 },
    lineHeight: { heading: 1.05, body: 1.3 },
    // Same hue order as paper, re-stepped for the dark surface. Validated on #17171c (dark mode):
    // lightness band, chroma floor, CVD (worst adjacent ΔE 12.0), normal-vision floor (20.5) and
    // ≥ 3:1 contrast all pass.
    chart: ['#7b86f0', '#d86a30', '#1fa8a8', '#9673f5', '#b38400', '#de5a8c'],
  },
  // Warm light theme. Same fonts (all OFL, Google Fonts); colors are our own.
  sand: {
    id: 'sand',
    name: 'Sand',
    dark: 'ink',
    colors: {
      bg: '#fbf8f3',
      surface: '#f2ece2',
      text: '#2b2420',
      muted: '#6e6259',
      border: '#e2d9cc',
      accent: '#b5532f',
      accent2: '#00907f',
      onAccent: '#ffffff',
      positive: '#3d7a2a',
      negative: '#b23a3a',
    },
    fonts: {
      heading: "'Instrument Serif', Georgia, serif",
      body: "'Geist', 'Segoe UI', system-ui, sans-serif",
      mono: "'Geist Mono', ui-monospace, monospace",
    },
    type: { title: 72, subtitle: 44, body: 34, caption: 24, min: 22 },
    lineHeight: { heading: 1.05, body: 1.3 },
    // Terracotta, teal, ochre, plum, olive, slate blue. Validated on #fbf8f3 (light): lightness
    // band, chroma floor, CVD (worst adjacent ΔE 10.6), normal-vision 16.6, contrast ≥ 3:1.
    chart: ['#b5532f', '#00907f', '#a07a10', '#7b4a8c', '#5d7a2a', '#3f5fa8'],
  },
  // Dark deck (dark in both editor modes; exports dark).
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      bg: '#14182b',
      surface: '#1e2440',
      text: '#eef0f8',
      muted: '#a8afc8',
      border: '#2e3656',
      accent: '#8ea2ff',
      accent2: '#ffb366',
      onAccent: '#14182b',
      positive: '#5cc98a',
      negative: '#ff7a7a',
    },
    fonts: {
      heading: "'Instrument Serif', Georgia, serif",
      body: "'Geist', 'Segoe UI', system-ui, sans-serif",
      mono: "'Geist Mono', ui-monospace, monospace",
    },
    type: { title: 72, subtitle: 44, body: 34, caption: 24, min: 22 },
    lineHeight: { heading: 1.05, body: 1.3 },
    // Validated on #14182b (dark): lightness band, chroma, CVD (worst adjacent ΔE 11.7),
    // normal-vision 20.9, contrast ≥ 3:1.
    chart: ['#6f80e8', '#cf7436', '#1f9a92', '#9b68d8', '#a68a12', '#cf5a86'],
  },
};

export const DEFAULT_THEME_ID = 'paper';

/** @type {ColorRole[]} */
export const COLOR_ROLES = /** @type {ColorRole[]} */ (Object.keys(THEMES.paper.colors));

/** Themes offered in the picker (Ink is only the dark-mode display variant). */
export const PICKABLE_THEMES = () => Object.values(THEMES).filter((t) => !t.hidden);

/**
 * @param {string | undefined} id
 * @param {'light'|'dark'} [scheme]  editor color scheme: in dark mode a theme with a `dark`
 *   counterpart is displayed as that counterpart. Export and print pass no scheme (the deck's own).
 * @returns {SlideTheme}
 */
export function getTheme(id, scheme) {
  const theme = (id && THEMES[id]) || THEMES[DEFAULT_THEME_ID];
  return scheme === 'dark' && theme.dark && THEMES[theme.dark] ? THEMES[theme.dark] : theme;
}
