/**
 * Chart rules shared by the canvas renderer, the data editor, the PowerPoint export and the AI
 * tools, so all four agree (D43, D51).
 */

/** A series with no data: every value 0, missing or not a number. Drawing it adds an empty legend
 *  entry and a row of "0" labels (the "Series 3 / Series 4" case). */
export const isEmptySeries = (s) =>
  !s.values.length || s.values.every((v) => v == null || !Number.isFinite(v) || v === 0);

/**
 * The series that are drawn: empty ones are left out (they stay in the data, so the editor still
 * shows them). A pie draws only its first series. If every series is empty, keep them all so the
 * chart still has axes.
 * @param {import('./schema/elements.js').ChartSpec} chart
 */
export function visibleSeries(chart) {
  const list = chart.kind === 'pie' ? chart.series.slice(0, 1) : chart.series;
  const filled = list.filter((s) => !isEmptySeries(s));
  return filled.length ? filled : list;
}

/**
 * A legend is drawn only where it says something: a pie (one entry per category) or two or more
 * drawn series. A single-series bar/line chart is named by its title instead (dataviz rule). The
 * editor hides the Legend toggle whenever this is false.
 */
export const legendAvailable = (chart) => chart.kind === 'pie' || visibleSeries(chart).length > 1;

/** Pie charts have no axes. */
export const hasAxes = (chart) => chart.kind !== 'pie';

const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
/** Smallest "round" number ≥ v (1, 1.2, 1.5, 2, 2.5 … × 10ⁿ), for axis ends people can read. */
export function niceCeil(v) {
  if (!(v > 0)) return 0;
  const exp = 10 ** Math.floor(Math.log10(v));
  const step = STEPS.find((s) => s * exp >= v - 1e-9) ?? 10;
  return step * exp;
}

/**
 * Value-axis range with headroom: the largest value never sits on the top gridline, so its data
 * label has room above the mark instead of running into the legend or the top tick. Stacked bars
 * use per-category totals. Negative data gets the same headroom below zero.
 * @returns {[number, number]}
 */
export function valueDomain(chart, headroom = 0.12) {
  const series = visibleSeries(chart);
  const n = chart.categories.length;
  let max = 0;
  let min = 0;
  if (chart.kind === 'stacked-bar') {
    for (let i = 0; i < n; i++) {
      let pos = 0;
      let neg = 0;
      for (const s of series) {
        const v = s.values[i] ?? 0;
        if (v > 0) pos += v;
        else neg += v;
      }
      max = Math.max(max, pos);
      min = Math.min(min, neg);
    }
  } else {
    for (const s of series)
      for (const v of s.values.slice(0, n)) {
        if (!Number.isFinite(v)) continue;
        max = Math.max(max, v);
        min = Math.min(min, v);
      }
  }
  const top = max > 0 ? niceCeil(max * (1 + headroom)) : 0;
  const bottom = min < 0 ? -niceCeil(-min * (1 + headroom)) : 0;
  return [bottom, top || 1];
}
