import { useRef, useState } from 'react';
import { getDeckState } from '@/hooks/useDeck.js';
import { expandToGroups } from '@/lib/groups.js';

const THRESHOLD = 4; // px of movement before a press on the background becomes a box select

const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Box selection on one slide (D44). A press on the slide background starts it; dragging draws a
 * rectangle and selects every unlocked element it touches (Shift adds to the selection). A press
 * without movement keeps the old behavior: deselect (gotcha 4).
 *
 * The rectangle is a screen-space overlay inside the frame, absolutely positioned, so it never
 * shifts layout. It starts only on the background itself, never on an element or on Moveable's
 * handles (those are separate DOM nodes), so it can't steal a drag or a resize.
 *
 * @param {{ current: HTMLElement|null }} frameRef
 * @param {string} slideId
 * @param {number} scale  artboard units -> screen px
 */
export function useMarquee(frameRef, slideId, scale) {
  const [rect, setRect] = useState(null); // { x, y, w, h } in frame px while dragging
  const drag = useRef(null);

  const onPointerDown = (e) => {
    const frame = frameRef.current;
    const onBackground = e.target === frame || e.target.classList?.contains('artboard');
    if (!frame || !onBackground || e.button !== 0) return;
    const s0 = getDeckState();
    if (s0.editingId) return; // the text editor's blur handles that click
    const origin = frame.getBoundingClientRect();
    const base = e.shiftKey ? s0.selection : [];
    drag.current = { x0: e.clientX - origin.left, y0: e.clientY - origin.top, moved: false };

    const onMove = (ev) => {
      const d = drag.current;
      if (!d) return;
      const box = frame.getBoundingClientRect(); // the column may scroll during the drag
      // Clamp to the slide: the box never spills over the gap or the next slide.
      const x1 = Math.min(Math.max(ev.clientX - box.left, 0), box.width);
      const y1 = Math.min(Math.max(ev.clientY - box.top, 0), box.height);
      if (!d.moved && Math.hypot(x1 - d.x0, y1 - d.y0) < THRESHOLD) return;
      d.moved = true;
      const r = {
        x: Math.min(d.x0, x1),
        y: Math.min(d.y0, y1),
        w: Math.abs(x1 - d.x0),
        h: Math.abs(y1 - d.y0),
      };
      setRect(r);
      const s = getDeckState();
      const slide = s.deck.slides[slideId];
      if (!slide) return;
      const inUnits = { x: r.x / scale, y: r.y / scale, w: r.w / scale, h: r.h / scale };
      const hit = slide.elementOrder.filter(
        (id) => !slide.elements[id].locked && intersects(slide.elements[id].bbox, inUnits),
      );
      // Touching one member of a group takes the whole group (D53).
      const next = expandToGroups(slide, [...base.filter((id) => slide.elements[id]), ...hit]);
      if (next.join() !== s.selection.join()) s.setSelection(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!drag.current?.moved) getDeckState().select(null); // plain click on the background
      drag.current = null;
      setRect(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return { onPointerDown, rect };
}
