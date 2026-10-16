import { useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { getDeckState, useDeckActions } from '@/hooks/useDeck.js';
import { clampCrop, coverCrop, resizeCrop, zoomCrop } from '@/lib/crop.js';
import { cn } from '@/primitives/cn.js';
import { Button } from '@/primitives/ui/button.jsx';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const STEP = 0.02; // arrow-key move, as a fraction of the image

/**
 * Crop an image element (D53). The whole source is shown with the kept region framed; the frame
 * has the box's shape, so the slide shows exactly what's framed. Drag the frame to move it, a
 * corner to resize, or use the keys (arrows move, + / − zoom). Each gesture is one undo step;
 * "Reset" removes the crop.
 */
export function ImageCropEditor({ el }) {
  const { patchElement } = useDeckActions();
  const [natural, setNatural] = useState(el.natural ?? null);
  const aspect = el.bbox.w / el.bbox.h;
  const saved = el.crop && natural ? el.crop : natural ? coverCrop(natural, aspect) : null;
  // The frame while a gesture is running; the saved crop otherwise.
  const [live, setLive] = useState(null);
  const crop = live ?? saved;
  const stageRef = useRef(null);
  const drag = useRef(null);

  const commit = (next, label = 'Crop image') => {
    setLive(null);
    if (JSON.stringify(next) === JSON.stringify(el.crop)) return;
    patchElement(el.id, { crop: next, natural, fit: 'cover' }, label);
  };

  const start = (e, mode) => {
    if (e.button !== 0 || !crop) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = stageRef.current.getBoundingClientRect();
    drag.current = { mode, x: e.clientX, y: e.clientY, from: crop, rw: r.width, rh: r.height };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.rw;
    const dy = (e.clientY - d.y) / d.rh;
    const next =
      d.mode === 'move'
        ? clampCrop({ ...d.from, x: d.from.x + dx, y: d.from.y + dy }, natural, aspect)
        : resizeCrop(d.from, d.mode, dx, natural, aspect);
    setLive(next);
  };
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    if (live) commit(live);
  };

  const onKey = (e) => {
    if (!crop) return;
    const k = e.key;
    let next;
    if (k === 'ArrowLeft') next = { ...crop, x: crop.x - STEP };
    else if (k === 'ArrowRight') next = { ...crop, x: crop.x + STEP };
    else if (k === 'ArrowUp') next = { ...crop, y: crop.y - STEP };
    else if (k === 'ArrowDown') next = { ...crop, y: crop.y + STEP };
    else if (k === '+' || k === '=') next = zoomCrop(crop, 0.9, natural, aspect);
    else if (k === '-') next = zoomCrop(crop, 1 / 0.9, natural, aspect);
    else return;
    e.preventDefault();
    e.stopPropagation(); // not a canvas nudge
    commit(clampCrop(next, natural, aspect));
  };

  const pct = (v) => `${v * 100}%`;
  return (
    <div className="space-y-4 text-ui">
      <p className="text-label text-faint">
        Drag the frame to choose what shows; drag a corner to zoom. Arrow keys move it, + and −
        zoom.
      </p>
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-md border bg-subtle select-none"
        style={natural ? { aspectRatio: `${natural.w} / ${natural.h}` } : { minHeight: 160 }}
      >
        <img
          src={el.src}
          alt={el.alt}
          draggable={false}
          className="block size-full"
          onLoad={(e) => {
            const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
            if (!natural || natural.w !== n.w || natural.h !== n.h) setNatural(n);
          }}
        />
        {crop && (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Crop frame"
            aria-valuetext={`Showing ${Math.round(crop.w * 100)}% of the width, from ${Math.round(crop.x * 100)}% left, ${Math.round(crop.y * 100)}% top`}
            onKeyDown={onKey}
            onPointerDown={(e) => start(e, 'move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute cursor-move ring-2 ring-white outline-none focus-visible:ring-user"
            // The dim outside the frame is one huge shadow, clipped by the stage.
            style={{
              left: pct(crop.x),
              top: pct(crop.y),
              width: pct(crop.w),
              height: pct(crop.h),
              boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.5)',
            }}
          >
            {CORNERS.map((c) => (
              <span
                key={c}
                aria-hidden
                onPointerDown={(e) => start(e, c)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                className={cn(
                  'absolute size-3.5 rounded-full border-2 border-user bg-white',
                  c[0] === 'n' ? '-top-[7px]' : '-bottom-[7px]',
                  c[1] === 'w' ? '-left-[7px]' : '-right-[7px]',
                  c === 'nw' || c === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
                )}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="xs"
          variant="secondary"
          disabled={!crop}
          onClick={() => commit(zoomCrop(crop, 0.85, natural, aspect), 'Zoom crop')}
        >
          <Plus strokeWidth={1.75} /> Zoom in
        </Button>
        <Button
          size="xs"
          variant="secondary"
          disabled={!crop}
          onClick={() => commit(zoomCrop(crop, 1 / 0.85, natural, aspect), 'Zoom crop')}
        >
          <Minus strokeWidth={1.75} /> Zoom out
        </Button>
        <Button
          size="xs"
          variant="ghost"
          disabled={!el.crop}
          onClick={() => {
            setLive(null);
            patchElement(el.id, { crop: null }, 'Reset crop');
          }}
        >
          <RotateCcw strokeWidth={1.75} /> Reset
        </Button>
        <Button size="xs" className="ml-auto" onClick={() => getDeckState().closeDrawer()}>
          Done
        </Button>
      </div>
    </div>
  );
}
