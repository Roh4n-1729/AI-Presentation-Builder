/**
 * A legend is drawn only where it says something: a pie (one entry per category) or two or more
 * series. A single-series bar/line chart is named by its title instead (dataviz rule). The editor
 * hides the Legend toggle whenever this is false.
 * @param {import('./schema/elements.js').ChartSpec} chart
 */
export const legendAvailable = (chart) => chart.kind === 'pie' || chart.series.length > 1;

/** Pie charts have no axes. */
export const hasAxes = (chart) => chart.kind !== 'pie';
