import { resolveColor } from '@/lib/theme/index.js';
import { stopEditorKeys, useSlideInteraction } from '../interaction.js';

/** Real <table>; in edit mode every cell is contentEditable and commits on blur. */
export function TableEl({ el, theme, editing }) {
  const ix = useSlideInteraction();
  const c = (role) => resolveColor(role, theme);
  return (
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
        fontSize: 28,
        color: c('text'),
      }}
    >
      <tbody>
        {el.rows.map((row, r) => {
          const header = el.headerRow && r === 0;
          return (
            <tr
              key={r}
              style={{ background: header ? c('accent') : r % 2 ? c('surface') : c('bg') }}
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
                    padding: '14px 20px',
                    border: `2px solid ${c('border')}`,
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
  );
}
