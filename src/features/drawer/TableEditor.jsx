import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useDeckActions } from '@/hooks/useDeck.js';
import { cn } from '@/primitives/cn.js';
import { Button } from '@/primitives/ui/button.jsx';
import { CellInput } from './fields.jsx';

const MAX_ROWS = 20;
const MAX_COLS = 10;

/** Table cells as a grid; add/remove rows and columns; header row on/off. */
export function TableEditor({ el }) {
  const { patchElement } = useDeckActions();
  const [rows, setRows] = useState(el.rows);
  const [seen, setSeen] = useState(el.rows);
  if (seen !== el.rows) {
    setSeen(el.rows);
    setRows(el.rows);
  }

  const commit = (next = rows, label = 'Edit table') => {
    if (JSON.stringify(next) !== JSON.stringify(el.rows))
      patchElement(el.id, { rows: next }, label);
  };
  const apply = (next, label) => {
    setRows(next);
    commit(next, label);
  };
  const cols = rows[0]?.length ?? 1;

  return (
    <div className="space-y-4 text-ui">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, r) => (
              <tr
                key={r}
                className={cn('border-t first:border-t-0', r === 0 && el.headerRow && 'bg-subtle')}
              >
                {row.map((cell, c) => (
                  <td key={c} className="min-w-28 p-1">
                    <CellInput
                      value={cell}
                      onChange={(v) =>
                        setRows(
                          rows.map((x, i) => (i === r ? x.map((y, j) => (j === c ? v : y)) : x)),
                        )
                      }
                      onCommit={() => commit()}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      title={cell}
                      data-first-cell={r === 0 && c === 0 ? '' : undefined}
                      className={r === 0 && el.headerRow ? 'font-medium' : undefined}
                    />
                  </td>
                ))}
                <td className="w-8 p-1 text-center">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove row ${r + 1}`}
                      onClick={() =>
                        apply(
                          rows.filter((_, i) => i !== r),
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
            {cols > 1 && (
              <tr className="border-t">
                {rows[0].map((_, c) => (
                  <td key={c} className="p-1 text-center">
                    <button
                      type="button"
                      aria-label={`Remove column ${c + 1}`}
                      onClick={() =>
                        apply(
                          rows.map((x) => x.filter((_, j) => j !== c)),
                          'Remove column',
                        )
                      }
                      className="rounded px-1.5 py-0.5 text-label text-muted-foreground hover:bg-border"
                    >
                      <X className="inline size-3" strokeWidth={1.5} /> col
                    </button>
                  </td>
                ))}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="xs"
          variant="secondary"
          disabled={rows.length >= MAX_ROWS}
          onClick={() => apply([...rows, Array(cols).fill('')], 'Add row')}
        >
          <Plus strokeWidth={1.75} /> Row
        </Button>
        <Button
          size="xs"
          variant="secondary"
          disabled={cols >= MAX_COLS}
          onClick={() =>
            apply(
              rows.map((x, i) => [...x, i === 0 && el.headerRow ? 'Column' : '']),
              'Add column',
            )
          }
        >
          <Plus strokeWidth={1.75} /> Column
        </Button>
        <label className="ml-auto flex items-center gap-1.5 text-label text-muted-foreground">
          <input
            type="checkbox"
            checked={el.headerRow}
            onChange={(e) =>
              patchElement(el.id, { headerRow: e.target.checked }, 'Toggle header row')
            }
          />
          Header row
        </label>
      </div>
    </div>
  );
}
