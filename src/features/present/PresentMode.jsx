import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { getTheme } from '@/lib/theme/index.js';
import { cn } from '@/primitives/cn.js';
import { SlideRenderer } from '@/features/slide/SlideRenderer.jsx';
import './present.css';

const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n']);
const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p']);

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

/**
 * Present mode: one slide at a time, scaled to the screen (fullscreen when the browser allows).
 * → / Space / PageDown next, ← / PageUp previous, Home / End, Esc to leave. Click to advance.
 */
export function PresentMode() {
  const presenting = useDeck((s) => s.presenting);
  const order = useDeck((s) => s.deck.slideOrder);
  const deck = useDeck((s) => s.deck);
  const scheme = useDeck((s) => s.colorScheme);
  const { w, h } = useViewport();
  const [idle, setIdle] = useState(false);
  const index = Math.min(presenting.index, order.length - 1);
  const slide = deck.slides[order[index]];
  const theme = getTheme(deck.theme, scheme);

  const go = (i) => {
    const s = getDeckState();
    const next = Math.max(0, Math.min(s.deck.slideOrder.length - 1, i));
    s.setPresenting({ index: next });
  };

  // Take focus from the editor: whatever had it (a text box being edited, the title input, a
  // drawer cell) would otherwise still receive typed keys behind the presentation. Blurring first
  // lets an open text edit commit through its normal blur path.
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    const prev = document.activeElement;
    if (prev instanceof HTMLElement) prev.blur();
    getDeckState().setEditing(null);
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const exit = () => {
      getDeckState().setPresenting(null);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
    const onKey = (e) => {
      const i = getDeckState().presenting?.index ?? 0;
      if (e.key === 'Escape') exit();
      else if (NEXT.has(e.key)) go(i + 1);
      else if (PREV.has(e.key)) go(i - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(Infinity);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    // Leaving fullscreen with the browser's own Esc also ends the presentation.
    const onFs = () => !document.fullscreenElement && getDeckState().setPresenting(null);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  // Hide the cursor and controls after 2 s without movement.
  useEffect(() => {
    let t = setTimeout(() => setIdle(true), 2000);
    const on = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2000);
    };
    window.addEventListener('mousemove', on);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', on);
    };
  }, []);

  if (!slide) return null;
  const scale = Math.min(w / ARTBOARD_W, h / ARTBOARD_H);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={cn('present-root', idle && 'idle')}
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting slide ${index + 1} of ${order.length}`}
      onClick={() => go(index + 1)}
    >
      <div
        className="relative overflow-hidden"
        style={{ width: ARTBOARD_W * scale, height: ARTBOARD_H * scale }}
      >
        <div className="artboard-scaler" style={{ transform: `scale(${scale})` }}>
          <SlideRenderer slide={slide} theme={theme} />
        </div>
      </div>
      <div
        className="present-hud absolute right-4 bottom-4 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-ui text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Previous slide"
          className="rounded-full p-1.5 hover:bg-white/15"
          onClick={() => go(index - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-1 tabular-nums">
          {index + 1} / {order.length}
        </span>
        <button
          type="button"
          aria-label="Next slide"
          className="rounded-full p-1.5 hover:bg-white/15"
          onClick={() => go(index + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Exit presentation"
          className="ml-1 rounded-full p-1.5 hover:bg-white/15"
          onClick={() => {
            getDeckState().setPresenting(null);
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
