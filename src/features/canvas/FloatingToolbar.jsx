import { useCallback, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  ChartColumn,
  ChartLine,
  ChartPie,
  Copy,
  Crop,
  Group,
  ImageUp,
  Info,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Table2,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { getDeckState, useDeck, useDeckActions } from '@/hooks/useDeck.js';
import { useInsert } from '@/hooks/useInsert.js';
import { useFeedback } from '@/hooks/useFeedback.js';
import { ARTBOARD_W } from '@/lib/constants.js';
import { groupState } from '@/lib/groups.js';
import { resolveColor } from '@/lib/theme/index.js';
import { cn } from '@/primitives/cn.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ToolbarGroup } from '@/primitives/ToolbarGroup.jsx';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

const BAR_H = 40;
/** How far the bar may stick out past the slide's edge: the slide column's side padding is 64 px,
 *  and the column clips anything beyond it (overflow-x: hidden). */
const OVERHANG = 56;
const SWATCHES = ['text', 'muted', 'accent', 'accent2', 'positive', 'negative'];
const SWATCH_NAMES = {
  text: 'Text',
  muted: 'Muted',
  accent: 'Accent',
  accent2: 'Accent 2',
  positive: 'Positive',
  negative: 'Negative',
};

function ColorMenu({ value, theme, onPick, label }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} title={label}>
          <span
            className="size-4 rounded-full ring-1 ring-border"
            style={{ background: resolveColor(value, theme) }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40">
        {SWATCHES.map((c) => (
          <DropdownMenuItem key={c} onSelect={() => onPick(c)}>
            <span
              className="size-3.5 rounded-full ring-1 ring-border"
              style={{ background: resolveColor(c, theme) }}
            />
            {SWATCH_NAMES[c]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TextControls({ el, theme }) {
  const { patchElement } = useDeckActions();
  const size = el.style?.fontSize ?? theme.type[el.role] ?? theme.type.body;
  const setStyle = (style, label) => patchElement(el.id, { style }, label);
  return (
    <>
      <ToolbarGroup>
        <IconButtonTip
          icon={Minus}
          label="Smaller text"
          onClick={() => setStyle({ fontSize: Math.max(12, size - 4) }, 'Text size')}
        />
        <span className="w-8 text-center font-mono text-label tabular-nums">{size}</span>
        <IconButtonTip
          icon={Plus}
          label="Larger text"
          onClick={() => setStyle({ fontSize: Math.min(200, size + 4) }, 'Text size')}
        />
      </ToolbarGroup>
      <ToolbarGroup>
        <IconButtonTip
          icon={Bold}
          label="Bold"
          active={(el.style?.fontWeight ?? 400) >= 600}
          onClick={() =>
            setStyle({ fontWeight: (el.style?.fontWeight ?? 400) >= 600 ? 400 : 700 }, 'Bold')
          }
        />
        {[
          ['left', AlignLeft],
          ['center', AlignCenter],
          ['right', AlignRight],
        ].map(([a, Icon]) => (
          <IconButtonTip
            key={a}
            icon={Icon}
            label={`Align ${a}`}
            active={(el.style?.align ?? 'left') === a}
            onClick={() => setStyle({ align: a }, 'Align text')}
          />
        ))}
        <ColorMenu
          label="Text color"
          theme={theme}
          value={
            el.style?.color ?? (el.role === 'subtitle' || el.role === 'caption' ? 'muted' : 'text')
          }
          onPick={(c) => setStyle({ color: c }, 'Text color')}
        />
      </ToolbarGroup>
    </>
  );
}

function ChartControls({ el }) {
  const { patchElement } = useDeckActions();
  const kinds = [
    ['bar', ChartColumn, 'Bar'],
    ['line', ChartLine, 'Line'],
    ['pie', ChartPie, 'Pie'],
  ];
  return (
    <ToolbarGroup>
      {kinds.map(([k, Icon, name]) => (
        <IconButtonTip
          key={k}
          icon={Icon}
          label={`${name} chart`}
          active={el.chart.kind === k}
          onClick={() =>
            patchElement(el.id, { chart: { ...el.chart, kind: k } }, 'Change chart type')
          }
        />
      ))}
      <Button size="sm" variant="ghost" onClick={() => getDeckState().openDrawer(el.id)}>
        Edit data
      </Button>
    </ToolbarGroup>
  );
}

function ImageControls({ el }) {
  const { patchElement } = useDeckActions();
  const { replaceImageFile } = useInsert();
  const feedback = useFeedback();
  const fileRef = useRef(null);
  return (
    <ToolbarGroup>
      <IconButtonTip
        icon={ImageUp}
        label="Replace image"
        onClick={() => fileRef.current?.click()}
      />
      {el.src && (
        <Button size="sm" variant="ghost" onClick={() => getDeckState().openDrawer(el.id)}>
          <Crop strokeWidth={1.5} /> Crop
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          patchElement(el.id, { fit: el.fit === 'cover' ? 'contain' : 'cover' }, 'Image fit')
        }
      >
        {el.fit === 'cover' ? 'Fill' : 'Fit'}
      </Button>
      {el.src && el.credit && (
        // Stock photo credit (D57): the licence asks for it; opens the photo's source page.
        <IconButtonTip
          icon={Info}
          label={`${el.credit.text} · via ${el.credit.source === 'openverse' ? 'Openverse' : 'Wikimedia Commons'}`}
          onClick={() => el.credit.url && window.open(el.credit.url, '_blank', 'noopener')}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file)
            replaceImageFile(el.id, file).catch((err) =>
              feedback.error("Couldn't replace the image", err.message),
            );
        }}
      />
    </ToolbarGroup>
  );
}

/**
 * Quick controls above the selection (type-specific), in screen space next to the slide, never
 * inside the renderer (D6). Hidden while dragging or editing text.
 */
export function FloatingToolbar({ slide, scale, theme }) {
  const selection = useDeck((s) => s.selection);
  const dragging = useDeck((s) => Boolean(s.draggingSlideId));
  const editingId = useDeck((s) => s.editingId);
  const aiBusy = useDeck((s) => s.aiBusy);
  const {
    duplicateSelection,
    deleteSelection,
    reorderElement,
    patchElement,
    groupSelection,
    ungroupSelection,
  } = useDeckActions();
  // The bar's width depends on the element type, so it's measured after render and the bar is
  // shifted left when it would run past the right edge (it used to be cut off by the column).
  // ResizeObserver reports before paint, so the bar never shows at the clipped position.
  const [barW, setBarW] = useState(0);
  const barRef = useCallback((node) => {
    if (!node) return;
    const ro = new ResizeObserver(() => setBarW(node.offsetWidth));
    ro.observe(node);
    return () => ro.disconnect(); // React 19 callback-ref cleanup
  }, []);

  const els = selection.map((id) => slide.elements[id]).filter(Boolean);
  if (!els.length || dragging || editingId || els.length !== selection.length) return null;

  const minX = Math.min(...els.map((e) => e.bbox.x));
  const minY = Math.min(...els.map((e) => e.bbox.y));
  const maxY = Math.max(...els.map((e) => e.bbox.y + e.bbox.h));
  const above = minY * scale - BAR_H - 10;
  const top = above > -8 ? above : maxY * scale + 10; // flip below when there's no room above
  const single = els.length === 1 ? els[0] : null;
  const frameW = ARTBOARD_W * scale;
  const left = Math.max(-OVERHANG, Math.min(minX * scale, frameW + OVERHANG - barW));

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Element tools"
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'absolute z-30 flex h-10 items-center gap-0.5 rounded-[10px] border bg-panel px-1 shadow-float',
        'animate-in duration-fast fade-in-0',
      )}
      style={{ left, top }}
    >
      {single?.type === 'text' && <TextControls el={single} theme={theme} />}
      {single?.type === 'chart' && <ChartControls el={single} />}
      {single?.type === 'table' && (
        <ToolbarGroup>
          <Button size="sm" variant="ghost" onClick={() => getDeckState().openDrawer(single.id)}>
            <Table2 strokeWidth={1.5} /> Edit table
          </Button>
        </ToolbarGroup>
      )}
      {single?.type === 'image' && <ImageControls el={single} />}
      {els.length > 1 && (
        <ToolbarGroup>
          {groupState(slide, selection).groupId ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={ungroupSelection}
              title="Ungroup (Ctrl+Shift+G)"
            >
              <Ungroup strokeWidth={1.5} /> Ungroup
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={groupSelection} title="Group (Ctrl+G)">
              <Group strokeWidth={1.5} /> Group
            </Button>
          )}
        </ToolbarGroup>
      )}
      {single?.type === 'shape' && (
        <ToolbarGroup>
          <ColorMenu
            label="Fill color"
            theme={theme}
            value={single.fill}
            onPick={(c) => patchElement(single.id, { fill: c }, 'Shape color')}
          />
        </ToolbarGroup>
      )}
      <ToolbarGroup>
        {single && (
          <>
            <IconButtonTip
              icon={ArrowUpToLine}
              label="Bring to front"
              onClick={() => reorderElement(single.id, 'front')}
            />
            <IconButtonTip
              icon={ArrowDownToLine}
              label="Send to back"
              onClick={() => reorderElement(single.id, 'back')}
            />
            <IconButtonTip
              icon={single.locked ? Lock : LockOpen}
              label={single.locked ? 'Unlock' : 'Lock (the AI and drags leave it alone)'}
              active={Boolean(single.locked)}
              onClick={() =>
                patchElement(
                  single.id,
                  { locked: single.locked ? null : true },
                  single.locked ? 'Unlock' : 'Lock',
                )
              }
            />
          </>
        )}
        <IconButtonTip
          icon={Copy}
          label="Duplicate"
          shortcut="Ctrl D"
          disabled={aiBusy}
          onClick={duplicateSelection}
        />
        <IconButtonTip icon={Trash2} label="Delete" shortcut="Del" onClick={deleteSelection} />
      </ToolbarGroup>
    </div>
  );
}
