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
import { resolveColor, seriesColor } from '@/lib/theme/index.js';

const TITLE_H = 64;

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
  const font = { fontFamily: theme.fonts.body, fontSize: 22, fill: muted };
  // Legend as plain HTML in the header row: never collides with the axis, always in series order
  // (color follows the entity, never alphabetical), text in ink colors.
  const legendItems =
    chart.kind === 'pie'
      ? chart.categories.map((name, i) => ({ name, color: theme.chart[i % theme.chart.length] }))
      : chart.series.map((s, i) => ({ name: s.name, color: seriesColor(s, i, theme) }));
  const showLegend = chart.showLegend && (chart.series.length > 1 || chart.kind === 'pie');
  const titleH = chart.title || showLegend ? TITLE_H : 0;
  const w = bbox.w;
  const h = Math.max(bbox.h - titleH, 40);

  let body;
  if (chart.kind === 'pie') {
    // Pie uses the first series; one color per category, fixed order. Colors go in the data
    // (`fill` per entry) because Recharts 3 deprecates <Cell>.
    const s = chart.series[0];
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
      chart.series.forEach((s) => {
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
    body = (
      <Chart
        width={w}
        height={h}
        data={rows}
        margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
        barGap={8}
      >
        <CartesianGrid stroke={line} strokeWidth={2} vertical={false} />
        <XAxis
          dataKey="name"
          tick={font}
          tickLine={false}
          axisLine={{ stroke: line, strokeWidth: 2 }}
          label={
            chart.xAxisLabel
              ? { value: chart.xAxisLabel, position: 'insideBottom', offset: -4, ...font }
              : undefined
          }
        />
        <YAxis
          tick={font}
          tickLine={false}
          axisLine={false}
          width={72}
          label={
            chart.yAxisLabel
              ? { value: chart.yAxisLabel, angle: -90, position: 'insideLeft', ...font }
              : undefined
          }
        />
        {chart.series.map((s, i) => {
          const color = seriesColor(s, i, theme);
          const isTop = !stacked || i === chart.series.length - 1;
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
                <LabelList dataKey={s.name} position="top" {...font} fill={ink} />
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
      {titleH > 0 && (
        <div style={{ height: TITLE_H, display: 'flex', alignItems: 'flex-start', gap: 32 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
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
          {showLegend && (
            <div
              style={{
                display: 'flex',
                gap: 24,
                fontSize: 22,
                color: ink,
                paddingTop: 6,
                paddingRight: 16,
                flexWrap: 'nowrap',
              }}
            >
              {legendItems.map((it, i) => (
                <span
                  key={`${it.name}-${i}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: 8, background: it.color }} />
                  {it.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {body}
    </div>
  );
}
