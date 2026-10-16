import { useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { SIDE_WIDTH } from '@/lib/constants.js';
import { cn } from '@/primitives/cn.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';

/** The slide column keeps at least this much room (plus the filmstrip) when the panel widens. */
const CANVAS_MIN = 520;
const STEP = 24;

const isWide = (w) => w >= (SIDE_WIDTH.default + SIDE_WIDTH.wide) / 2;
/** Upper bound right now: the store's max, but never squeezing the canvas below CANVAS_MIN. */
const maxForWindow = () => Math.max(SIDE_WIDTH.min, window.innerWidth - CANVAS_MIN - 240);
const setWidth = (w) => getDeckState().setSideWidth(Math.min(w, maxForWindow()));

/**
 * Drag handle on the panel's left edge. Pointer capture keeps the drag alive over the canvas;
 * the width is written live (the slide column rescales as it goes). Arrow keys resize in 24 px
 * steps, double-click toggles normal / wide.
 */
function ResizeHandle() {
  const width = useDeck((s) => s.sideWidth);
  const start = useRef(null);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: getDeckState().sideWidth };
    document.body.classList.add('side-resizing');
  };
  const onPointerMove = (e) => {
    if (!start.current) return;
    // The handle is on the left edge, so dragging left (smaller x) widens the panel.
    setWidth(start.current.w + (start.current.x - e.clientX));
  };
  const end = () => {
    start.current = null;
    document.body.classList.remove('side-resizing');
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side panel"
      aria-valuemin={SIDE_WIDTH.min}
      aria-valuemax={SIDE_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to toggle wide"
      className="group absolute inset-y-0 left-0 z-20 w-1.5 cursor-(--cursor-resize-x) outline-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={() => setWidth(isWide(width) ? SIDE_WIDTH.default : SIDE_WIDTH.wide)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setWidth(width + STEP);
        else if (e.key === 'ArrowRight') setWidth(width - STEP);
        else return;
        e.preventDefault();
        e.stopPropagation(); // not a canvas nudge / slide step
      }}
    >
      <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors duration-fast group-hover:bg-user/60 group-focus-visible:bg-user" />
    </div>
  );
}

/** Header button: widen the panel (e.g. for a big data table) or bring it back to normal. */
export function ExpandPanelButton({ className }) {
  const wide = useDeck((s) => isWide(s.sideWidth));
  return (
    <IconButtonTip
      icon={wide ? Minimize2 : Maximize2}
      label={wide ? 'Narrow panel' : 'Widen panel'}
      className={className}
      onClick={() => setWidth(wide ? SIDE_WIDTH.default : SIDE_WIDTH.wide)}
    />
  );
}

/** The right-hand panel shell (AI chat or data editor): shared width, resizable from its edge. */
export function SidePanel({ className, children, ref, ...rest }) {
  const width = useDeck((s) => s.sideWidth);
  return (
    <aside
      ref={ref}
      className={cn('relative flex shrink-0 flex-col border-l bg-panel', className)}
      style={{ width }}
      {...rest}
    >
      <ResizeHandle />
      {children}
    </aside>
  );
}
