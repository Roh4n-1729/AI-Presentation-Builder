import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useDeckActions } from '@/hooks/useDeck.js';
import { hasAxes, legendAvailable } from '@/lib/chart.js';
import { chartFromGrid, looksLikeGrid, parseGrid } from '@/lib/tabular.js';
import { cn } from '@/primitives/cn.js';
import { Button } from '@/primitives/ui/button.jsx';
import { CellInput } from './fields.jsx';

const KINDS = [
  ['bar', 'Bar'],
  ['stacked-bar', 'Stacked'],
  ['line', 'Line'],
  ['area', 'Area'],
  ['pie', 'Pie'],
];
const MAX_SERIES = 8;
const MAX_ROWS = 24;

/** Chart spec -> editable draft (numbers as strings so "-" or "1." can be typed). */
const toDraft = (c) => ({
  ...c,
  series: c.series.map((s) => ({ ...s, values: s.values.map(String) })),
});
const num = (v) => {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
/** Draft -> valid chart spec (every series has one value per category). */
const fromDraft = (d) => ({
  ...d,
  title: d.title?.trim() || undefined,
  xAxisLabel: d.xAxisLabel?.trim() || undefined,
  yAxisLabel: d.yAxisLabel?.trim() || undefined,
  categories: d.categories.map((c, i) => c.trim() || `Item ${i + 1}`),
  series: d.series.map((s, i) => ({
    ...s,
    name: s.name.trim() || `Series ${i + 1}`,
    values: d.categories.map((_, r) => num(s.values[r] ?? 0)),
  })),
});

function Section({ label, children, className }) {
  return (
    <section className={cn('space-y-1.5', className)}>
      <h3 className="text-label font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}

function Check({ label, checked, onChange, hint }) {
  return (
    <label className="flex items-center gap-2 text-ui" title={hint}>
      <input
        type="checkbox"
        className="accent-[var(--user)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/**
 * Type, title, axes, display options and the data grid (categories down, one column per series).
 * Each committed field is one undo step.
 */
export function ChartDataEditor({ el }) {
  const { patchElement } = useDeckActions();
  const [draft, setDraft] = useState(() => toDraft(el.chart));
  // Re-sync when the chart changes from outside (undo, AI edit) — React's "adjust state on prop
  // change" pattern, so inputs keep focus during our own commits.
  const [seen, setSeen] = useState(el.chart);
  if (seen !== el.chart) {
    setSeen(el.chart);
    setDraft(toDraft(el.chart));
  }

  const commit = (next = draft, label = 'Edit chart data') => {
    const chart = fromDraft(next);
    if (JSON.stringify(chart) !== JSON.stringify(el.chart)) patchElement(el.id, { chart }, label);
  };
  /** Change the draft and commit at once (structure and options). */
  const apply = (next, label) => {
    setDraft(next);
    commit(next, label);
  };
  const setCell = (s, r, v) =>
    setDraft((d) => ({
      ...d,
      series: d.series.map((x, i) =>
        i === s ? { ...x, values: x.values.map((y, j) => (j === r ? v : y)) } : x,
      ),
    }));

  // Paste cells from a spreadsheet (or CSV text) anywhere in the data grid: replaces the data,
  // keeps the chart type and options. One undo step (D53).
  const [pasteNote, setPasteNote] = useState('');
  const onPaste = (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (!looksLikeGrid(text)) return; // a single value: normal paste into the cell
    e.preventDefault();
    const r = chartFromGrid(parseGrid(text));
    if (!r.ok) {
      setPasteNote(r.error);
      return;
    }
    const series = r.series.map((x) => ({ ...x, values: x.values.map(String) }));
    apply({ ...draft, categories: r.categories, series }, 'Paste chart data');
    setPasteNote(
      `Pasted ${r.categories.length} rows, ${series.length} series${r.note ? ` (${r.note})` : ''}.`,
    );
  };

  const pie = draft.kind === 'pie';
  // A pie shows one series: edit just that one, so the grid has room for full category names.
  const visibleSeries = pie ? draft.series.slice(0, 1) : draft.series;

  return (
    <div className="space-y-5 text-ui">
      <Section label="Type">
        <div className="flex flex-wrap gap-1">
          {KINDS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => apply({ ...draft, kind: k }, 'Change chart type')}
              aria-pressed={draft.kind === k}
              className={cn(
                'rounded-md border px-2.5 py-1 text-label transition-colors duration-fast',
                draft.kind === k ? 'border-user bg-user-soft text-user' : 'hover:bg-subtle',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Title">
        <CellInput
          className="border-border"
          value={draft.title ?? ''}
          placeholder="No title"
          onChange={(v) => setDraft({ ...draft, title: v })}
          onCommit={() => commit()}
          aria-label="Chart title"
        />
      </Section>

      {hasAxes(draft) && (
        <Section label="Axes">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-label text-muted-foreground">X axis label</span>
              <CellInput
                className="border-border"
                value={draft.xAxisLabel ?? ''}
                placeholder="e.g. Quarter"
                onChange={(v) => setDraft({ ...draft, xAxisLabel: v })}
                onCommit={() => commit(draft, 'Axis label')}
                aria-label="X axis label"
              />
            </label>
            <label className="space-y-1">
              <span className="text-label text-muted-foreground">Y axis label</span>
              <CellInput
                className="border-border"
                value={draft.yAxisLabel ?? ''}
                placeholder="e.g. INR Cr"
                onChange={(v) => setDraft({ ...draft, yAxisLabel: v })}
                onCommit={() => commit(draft, 'Axis label')}
                aria-label="Y axis label"
              />
            </label>
          </div>
        </Section>
      )}

      <Section label="Show">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Check
            label="Values on the chart"
            checked={Boolean(draft.showDataLabels)}
            onChange={(v) => apply({ ...draft, showDataLabels: v }, 'Value labels')}
          />
          {/* Only where a legend is drawn: a pie, or two or more series. */}
          {legendAvailable(draft) && (
            <Check
              label="Legend"
              checked={draft.showLegend !== false}
              onChange={(v) => apply({ ...draft, showLegend: v }, 'Toggle legend')}
            />
          )}
        </div>
      </Section>

      <Section label="Data">
        <p className="text-label text-faint">Paste cells from a spreadsheet to replace the data.</p>
        <div className="overflow-x-auto rounded-md border" onPaste={onPaste}>
          <table className="w-full min-w-max table-fixed border-collapse">
            <colgroup>
              <col style={{ width: 116 }} />
              {visibleSeries.map((_, i) => (
                <col key={i} style={{ width: 92 }} />
              ))}
              <col style={{ width: 28 }} />
            </colgroup>
            <thead>
              <tr className="bg-subtle">
                <th className="px-2.5 py-1.5 text-left text-label font-medium text-muted-foreground">
                  {pie ? 'Slice' : 'Category'}
                </th>
                {visibleSeries.map((s, i) => (
                  <th key={i} className="p-1">
                    <div className="flex items-center gap-0.5">
                      <CellInput
                        value={s.name}
                        title={s.name}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            series: draft.series.map((x, j) => (j === i ? { ...x, name: v } : x)),
                          })
                        }
                        onCommit={() => commit()}
                        aria-label={`Series ${i + 1} name`}
                        className="text-right font-medium"
                      />
                      {!pie && draft.series.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove series ${s.name}`}
                          title={`Remove series ${s.name}`}
                          onClick={() =>
                            apply(
                              { ...draft, series: draft.series.filter((_, j) => j !== i) },
                              'Remove series',
                            )
                          }
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-border"
                        >
                          <X className="size-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.categories.map((c, r) => (
                <tr key={r} className="border-t">
                  <td className="p-1">
                    <CellInput
                      value={c}
                      title={c}
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          categories: draft.categories.map((x, j) => (j === r ? v : x)),
                        })
                      }
                      onCommit={() => commit()}
                      aria-label={`Category ${r + 1}`}
                    />
                  </td>
                  {visibleSeries.map((s, i) => (
                    <td key={i} className="p-1">
                      <CellInput
                        numeric
                        value={s.values[r] ?? ''}
                        onChange={(v) => setCell(i, r, v)}
                        onCommit={() => commit()}
                        aria-label={`${s.name}, ${c}`}
                        data-first-cell={r === 0 && i === 0 ? '' : undefined}
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    {draft.categories.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove row ${c}`}
                        title={`Remove row ${c}`}
                        onClick={() =>
                          apply(
                            {
                              ...draft,
                              categories: draft.categories.filter((_, j) => j !== r),
                              series: draft.series.map((s) => ({
                                ...s,
                                values: s.values.filter((_, j) => j !== r),
                              })),
                            },
                            'Remove row',
                          )
                        }
                        className="rounded p-0.5 text-muted-foreground hover:bg-border"
                      >
                        <X className="size-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pasteNote && (
          <p role="status" className="text-label text-muted-foreground">
            {pasteNote}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="xs"
            variant="secondary"
            disabled={draft.categories.length >= MAX_ROWS}
            onClick={() =>
              apply(
                {
                  ...draft,
                  categories: [...draft.categories, `Item ${draft.categories.length + 1}`],
                  series: draft.series.map((s) => ({ ...s, values: [...s.values, '0'] })),
                },
                'Add row',
              )
            }
          >
            <Plus strokeWidth={1.75} /> Row
          </Button>
          {!pie && (
            <Button
              size="xs"
              variant="secondary"
              disabled={draft.series.length >= MAX_SERIES}
              onClick={() =>
                apply(
                  {
                    ...draft,
                    series: [
                      ...draft.series,
                      {
                        name: `Series ${draft.series.length + 1}`,
                        values: draft.categories.map(() => '0'),
                      },
                    ],
                  },
                  'Add series',
                )
              }
            >
              <Plus strokeWidth={1.75} /> Series
            </Button>
          )}
        </div>
        {pie && draft.series.length > 1 && (
          <p className="text-label text-muted-foreground">
            A pie shows one series ({draft.series[0].name}). The other {draft.series.length - 1} are
            kept and come back if you switch to bar or line.
          </p>
        )}
      </Section>
    </div>
  );
}
