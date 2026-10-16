import { useRef } from 'react';
import { resolveColor } from '@/lib/theme/index.js';
import { stopEditorKeys, useSlideInteraction } from '../interaction.js';
import { useFittedSize } from './fit.js';

const BASE_SIZE = 28; // artboard units (14 pt in PowerPoint)
const MIN_SIZE = 18; // tables are dense: they may shrink a little further than body text

/**
 * Real <table>; in edit mode every cell is contentEditable and commits on blur.
 * The table fills its box and the rows share the height, each at least one line of text plus
 * padding (D56), so dragging a handle stretches the rows, as in PowerPoint. New tables start one
 * row height per row (tableBoxAt). If the rows outgrow the box the text shrinks to fit, like a
 * text box (down to the table minimum). Padding is in em so it shrinks with the text.
 */
export function TableEl({ el, theme, editing }) {
  const ix = useSlideInteraction();
  const c = (role) => resolveColor(role, theme);
  const boxRef = useRef(null);
  const fontSize = useFittedSize(boxRef, BASE_SIZE, Math.min(MIN_SIZE, theme.type.min), [
    el.rows,
    el.headerRow,
    el.bbox.w,
    el.bbox.h,
    editing,
  ]);
  const accent = c('accent');
  const line = c('border');
  return (
    // The size sits on the box, not the table, so the fit measurement (which sets the box's font
    // size) reaches every cell through inheritance.
    <div ref={boxRef} style={{ width: '100%', height: '100%', overflow: 'hidden', fontSize }}>
      <table
        onBlur={
          editing
            ? (e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) ix?.endEdit();
              }
            : undefined
        }
        style={{
          width: '100%',
          height: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: theme.fonts.body,
          lineHeight: 1.3,
          color: c('text'),
        }}
      >
        <tbody>
          {el.rows.map((row, r) => {
            const header = el.headerRow && r === 0;
            return (
              <tr
                key={r}
                // One line of text plus padding even when empty, so blank rows keep their height.
                style={{
                  height: '2.2em',
                  background: header ? accent : r % 2 ? c('surface') : c('bg'),
                }}
              >
                {row.map((cell, col) => (
                  <td
                    key={col}
                    tabIndex={editing ? 0 : undefined}
                    contentEditable={editing}
                    suppressContentEditableWarning
                    onBlur={
                      editing
                        ? (e) => ix?.commitCell(el, r, col, e.currentTarget.innerText)
                        : undefined
                    }
                    onKeyDown={editing ? stopEditorKeys : undefined}
                    style={{
                      padding: '0.45em 0.7em',
                      verticalAlign: 'middle',
                      // Header dividers in the header's own color (no dark seams); a hairline grid below.
                      border: `2px solid ${header ? accent : line}`,
                      color: header ? c('onAccent') : c('text'),
                      fontWeight: header ? 600 : 400,
                      outline: 'none',
                      cursor: editing ? 'text' : 'inherit',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
