const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** @param {unknown} value */
export const isHexColor = (value) => typeof value === 'string' && HEX.test(value);

/**
 * Turn a stored color (a theme role like 'accent', a literal hex override, or 'transparent')
 * into a CSS color. Anything unknown falls back to `fallbackRole`, so a bad value from the model
 * renders as readable text instead of breaking the slide.
 *
 * @param {string | undefined} value
 * @param {import('./themes.js').SlideTheme} theme
 * @param {import('./themes.js').ColorRole} [fallbackRole]
 */
export function resolveColor(value, theme, fallbackRole = 'text') {
  if (value === 'transparent') return 'transparent';
  if (isHexColor(value)) return value;
  if (typeof value === 'string' && Object.hasOwn(theme.colors, value)) return theme.colors[value];
  return theme.colors[fallbackRole];
}

/** A theme palette slot, `chart1` … `chart6`: follows the theme, as a role does (D72). */
const PALETTE_SLOT = /^chart([1-9])$/;

/**
 * Color for the i-th chart series: its own color if set (a palette slot, a role or a hex), else
 * the theme palette in fixed order (wraps only past six series, which the chart editor discourages).
 *
 * @param {{ color?: string } | undefined} series
 * @param {number} index
 * @param {import('./themes.js').SlideTheme} theme
 */
export function seriesColor(series, index, theme) {
  const slot = PALETTE_SLOT.exec(series?.color ?? '');
  if (slot) return theme.chart[(Number(slot[1]) - 1) % theme.chart.length];
  if (series?.color) return resolveColor(series.color, theme, 'accent');
  return theme.chart[index % theme.chart.length];
}
