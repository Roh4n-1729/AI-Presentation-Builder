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
 */

/** @typedef {'bg'|'surface'|'text'|'muted'|'border'|'accent'|'accent2'|'onAccent'|'positive'|'negative'} ColorRole */

/** @type {Record<string, SlideTheme>} */
export const THEMES = {
  paper: {
    id: 'paper',
    name: 'Paper',
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
};

export const DEFAULT_THEME_ID = 'paper';

/** @type {ColorRole[]} */
export const COLOR_ROLES = /** @type {ColorRole[]} */ (Object.keys(THEMES.paper.colors));

/** @param {string | undefined} id @returns {SlideTheme} */
export function getTheme(id) {
  return (id && THEMES[id]) || THEMES[DEFAULT_THEME_ID];
}
