import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { legendAvailable, valueDomain, visibleSeries } from '@/lib/chart.js';
import { resolveColor, seriesColor } from '@/lib/theme/index.js';

const TITLE_H = 48; // title line
const LEGEND_H = 40; // legend line, under the title (own row, so a long legend never hides the title)
const LABEL_FONT = 22;
// Axis titles get their own line beside the tick labels (D80): the axis area grows by one label
// line plus a gap, so a title never sits on the ticks.
const AXIS_TITLE_SPACE = LABEL_FONT + 16;
const X_TICKS_H = 36; // tick labels under the x axis
const Y_TICKS_W = 80; // tick labels left of the y axis

// Axis ticks stay short on big axes (4K, 8K, 12K: one format for the whole axis, chosen by its
// range); data labels show the exact value with digit grouping (12,000).
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const exact = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const tickFormatFor = ([lo, hi]) =>
  Math.max(Math.abs(lo), Math.abs(hi)) >= 10000 ? (v) => compact.format(v) : (v) => exact.format(v);
const labelText = (v) => (v == null ? '' : exact.format(v));

/**
 * A real Recharts chart (not an image). Explicit width/height = bbox, no ResponsiveContainer
 * (spike gotcha 9: it measures the scaled parent wrong); no animation, so drags and AI edits
 * re-render instantly; pointer-events off so the element wrapper receives drags.
 * Marks follow the dataviz rules: thin lines, rounded bar ends, recessive grid, legend for ≥ 2
 * series in series order (never re-sorted), text in ink colors, not series colors.
 */
export function ChartEl({ el, theme }) {
  const { chart, bbox } = el;
  const ink = resolveColor('text', theme);
  const muted = resolveColor('muted', theme);
  const line = resolveColor('border', theme);
  const surface = resolveColor('bg', theme);
  const font = { fontFamily: theme.fonts.body, fontSize: LABEL_FONT, fill: muted };
  // Empty series (all zero / missing) aren't drawn or listed: they only add a blank legend entry
  // and a row of "0" labels. They stay in the data for the editor (D51).
  const series = visibleSeries(chart);
  // Legend as plain HTML in the header row: never collides with the axis, always in series order
  // (color follows the entity, never alphabetical), text in ink colors.
  const legendItems =
    chart.kind === 'pie'
      ? chart.categories.map((name, i) => ({ name, color: theme.chart[i % theme.chart.length] }))
      : series.map((s) => ({
          name: s.name,
          color: seriesColor(s, chart.series.indexOf(s), theme),
        }));
  const showLegend = chart.showLegend !== false && legendAvailable(chart);
  const titleH = (chart.title ? TITLE_H : 0) + (showLegend ? LEGEND_H : 0);
  const w = bbox.w;
  const h = Math.max(bbox.h - titleH, 40);

  let body;
  if (chart.kind === 'pie') {
    // Pie uses the first series; one color per category, fixed order. Colors go in the data
    // (`fill` per entry) because Recharts 3 deprecates <Cell>.
    const s = series[0];
    const data = chart.categories.map((name, i) => ({
      name,
      value: s?.values[i] ?? 0,
      fill: theme.chart[i % theme.chart.length],
    }));
    const r = Math.min(w, h) / 2.5;
    body = (
      <PieChart width={w} height={h}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={r}
          innerRadius={r * 0.55}
          stroke={surface}
          strokeWidth={4}
          isAnimationActive={false}
          label={chart.showDataLabels ? { ...font, fill: ink } : false}
        />
      </PieChart>
    );
  } else {
    const rows = chart.categories.map((name, i) => {
      const row = { name };
      series.forEach((s) => {
        row[s.name] = s.values[i] ?? 0;
      });
      return row;
    });
    const stacked = chart.kind === 'stacked-bar';
    const [Chart, Mark] = {
      bar: [BarChart, Bar],
      'stacked-bar': [BarChart, Bar],
      line: [LineChart, Line],
      area: [AreaChart, Area],
    }[chart.kind];
    const pointMarks = chart.kind === 'line' || chart.kind === 'area';
    const domain = valueDomain(chart);
    body = (
      <Chart
        width={w}
        height={h}
        data={rows}
        // Top margin fits a value label above the top gridline; the axis range adds headroom
        // above the largest value, so labels never run into the legend or the top tick.
        margin={{ top: chart.showDataLabels ? LABEL_FONT + 16 : 20, right: 24, left: 8, bottom: 8 }}
        barGap={8}
      >
        <CartesianGrid stroke={line} strokeWidth={2} vertical={false} />
        <XAxis
          dataKey="name"
          tick={font}
          tickLine={false}
          interval={0}
          // Lines and areas start a step in from the axis, so the first point and its label
          // don't sit on the value axis and its top tick.
          padding={pointMarks ? { left: 40, right: 40 } : undefined}
          axisLine={{ stroke: line, strokeWidth: 2 }}
          height={X_TICKS_H + (chart.xAxisLabel ? AXIS_TITLE_SPACE : 0)}
          label={
            chart.xAxisLabel
              ? { value: chart.xAxisLabel, position: 'insideBottom', offset: 0, ...font }
              : undefined
          }
        />
        <YAxis
          tick={font}
          tickLine={false}
          axisLine={false}
          width={Y_TICKS_W + (chart.yAxisLabel ? AXIS_TITLE_SPACE : 0)}
          domain={domain}
          tickCount={5}
          tickFormatter={tickFormatFor(domain)}
          label={
            chart.yAxisLabel
              ? { value: chart.yAxisLabel, angle: -90, position: 'insideLeft', ...font }
              : undefined
          }
        />
        {series.map((s, i) => {
          const color = seriesColor(s, chart.series.indexOf(s), theme);
          const isTop = !stacked || i === series.length - 1;
          return (
            <Mark
              key={`${s.name}-${i}`}
              dataKey={s.name}
              name={s.name}
              isAnimationActive={false}
              stackId={stacked ? 'stack' : undefined}
              fill={color}
              stroke={chart.kind === 'bar' || stacked ? surface : color}
              strokeWidth={chart.kind === 'bar' || stacked ? 3 : 5}
              fillOpacity={chart.kind === 'area' ? 0.18 : 1}
              radius={chart.kind === 'bar' || (stacked && isTop) ? [8, 8, 0, 0] : undefined}
              dot={
                chart.kind === 'line'
                  ? { r: 8, fill: surface, stroke: color, strokeWidth: 4 }
                  : undefined
              }
              type={chart.kind === 'bar' || stacked ? undefined : 'monotone'}
            >
              {chart.showDataLabels && (
                <LabelList
                  dataKey={s.name}
                  // Stacked segments label inside; bars and points label above, clear of the mark.
                  position={stacked ? 'center' : 'top'}
                  offset={pointMarks ? 16 : 10}
                  formatter={labelText}
                  {...font}
                  fill={stacked ? resolveColor('onAccent', theme) : ink}
                />
              )}
            </Mark>
          );
        })}
      </Chart>
    );
  }

  return (
    <div
      style={{ width: '100%', height: '100%', pointerEvents: 'none', fontFamily: theme.fonts.body }}
    >
      {chart.title && (
        <div
          style={{
            height: TITLE_H,
            fontSize: 30,
            fontWeight: 600,
            color: ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {chart.title}
        </div>
      )}
      {showLegend && (
        <div
          style={{
            height: LEGEND_H,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            fontSize: 22,
            color: ink,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {legendItems.map((it, i) => (
            <span
              key={`${it.name}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  flex: 'none',
                  borderRadius: 8,
                  background: it.color,
                }}
              />
              {it.name}
            </span>
          ))}
        </div>
      )}
      {body}
    </div>
  );
}
