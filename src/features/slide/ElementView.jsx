import { memo } from 'react';
import { ChartEl } from './elements/ChartEl.jsx';
import { ImageEl } from './elements/ImageEl.jsx';
import { ShapeEl } from './elements/ShapeEl.jsx';
import { TableEl } from './elements/TableEl.jsx';
import { TextEl } from './elements/TextEl.jsx';
import { useSlideInteraction } from './interaction.js';
import { TABLE_MIN_ROW_UNITS } from '@/lib/tabular.js';

const RENDERERS = { text: TextEl, chart: ChartEl, table: TableEl, image: ImageEl, shape: ShapeEl };

/** Positions one element at its bbox (artboard units). Interaction comes from context, if any. */
export const ElementView = memo(function ElementView({ el, theme, editing }) {
  const ix = useSlideInteraction();
  const Renderer = RENDERERS[el.type];
  const { x, y, w, h, rotation } = el.bbox;
  const editable = el.type === 'text' || el.type === 'table';

  return (
    <div
      className="el"
      data-el-id={el.id}
      data-locked={el.locked || undefined}
      onPointerDown={ix && !editing ? (e) => ix.onElementPointerDown(e, el) : undefined}
      onDoubleClick={ix && editable && !el.locked ? () => ix.onElementDoubleClick(el) : undefined}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        // A table can't be squashed below one line of its smallest text per row (D56); Moveable
        // honours min-height while resizing.
        minHeight: el.type === 'table' ? el.rows.length * TABLE_MIN_ROW_UNITS : undefined,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        cursor: ix ? (editing ? 'text' : 'move') : 'default',
      }}
    >
      {Renderer && <Renderer el={el} theme={theme} editing={editing} />}
    </div>
  );
});
