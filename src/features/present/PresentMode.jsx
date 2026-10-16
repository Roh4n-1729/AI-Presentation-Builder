import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, NotebookPen, X } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { usePresentNavigation } from '@/hooks/usePresentNavigation.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { getTheme } from '@/lib/theme/index.js';
import { cn } from '@/primitives/cn.js';
import { SlideRenderer } from '@/features/slide/SlideRenderer.jsx';
import './present.css';

const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']);
const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);
const IDLE_AFTER = 2000; // hide controls and cursor after this long without movement

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
 * Which slide is on screen and which one is leaving. "Adjusting state while rendering" (React's
 * documented pattern for reacting to a prop change): when the index changes, the old slide becomes
 * the leaving layer for one transition. A new change mid-transition simply replaces it.
 */
function useSlideTransition(index) {
  const [t, setT] = useState({ index, leaving: null, dir: 1, seq: 0 });
  if (t.index !== index) {
    setT({ index, leaving: t.index, dir: index > t.index ? 1 : -1, seq: t.seq + 1 });
  }
  const done = () => setT((s) => (s.leaving === null ? s : { ...s, leaving: null }));
  return { ...t, done };
}

/**
 * Present mode: one slide at a time, scaled to the screen (fullscreen when the browser allows).
 * → / Space / PageDown next, ← / PageUp previous, Home / End, N speaker notes, Esc to leave.
 * Click to advance; advancing past the last slide ends the presentation. Slides change with the deck's transition (none / fade / push), timed by the
 * motion tokens (D48).
 */
export function PresentMode({ index: requested }) {
  const order = useDeck((s) => s.deck.slideOrder);
  const deck = useDeck((s) => s.deck);
  const scheme = useDeck((s) => s.colorScheme);
  const { w, h } = useViewport();
  const [idle, setIdle] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const index = Math.min(requested, order.length - 1);
  // Moving between slides and leaving are URL changes (D59): /deck/:id/present/:slide.
  const nav = usePresentNavigation();
  const leaving = useRef(false);
  // Leave once: Esc also ends fullscreen, whose change event would otherwise leave a second
  // time (two history steps back).
  const exit = () => {
    if (leaving.current) return;
    leaving.current = true;
    nav.exit();
  };
  // "Next" on the last slide ends the presentation (D55), as in PowerPoint and Keynote; going
  // back from the first slide just stays there.
  // The slide we're on or heading to. A navigation re-renders a moment later, so two quick key
  // presses must count from the target of the first, not from the slide still on screen.
  const pos = useRef(index);
  useLayoutEffect(() => {
    pos.current = index;
  }, [index]);
  const go = (i) => {
    pos.current = Math.max(0, Math.min(getDeckState().deck.slideOrder.length - 1, i));
    nav.go(pos.current);
  };
  const advance = (from) => {
    if (from + 1 >= getDeckState().deck.slideOrder.length) exit();
    else go(from + 1);
  };
  // The window listeners are attached once; they call the latest handlers through this ref.
  const handlers = useRef(null);
  useLayoutEffect(() => {
    handlers.current = { advance, exit, go };
  });
  const t = useSlideTransition(index);
  const transition = deck.transition ?? 'fade';
  const theme = getTheme(deck.theme, scheme);

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
    const onKey = (e) => {
      const i = pos.current;
      const n = handlers.current;
      if (e.key === 'Escape') n.exit();
      else if (NEXT.has(e.key)) n.advance(i);
      else if (PREV.has(e.key)) n.go(i - 1);
      else if (e.key === 'Home') n.go(0);
      else if (e.key === 'End') n.go(getDeckState().deck.slideOrder.length - 1);
      else if (e.key === 'n' || e.key === 'N') setShowNotes((v) => !v);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    // Leaving fullscreen with the browser's own Esc also ends the presentation.
    const onFs = () => !document.fullscreenElement && handlers.current.exit();
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), IDLE_AFTER);
    const on = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_AFTER);
    };
    window.addEventListener('mousemove', on);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', on);
    };
  }, []);

  const slide = deck.slides[order[t.index]];
  if (!slide) return null;
  const leavingSlide =
    transition !== 'none' && t.leaving !== null ? deck.slides[order[t.leaving]] : null;
  const scale = Math.min(w / ARTBOARD_W, h / ARTBOARD_H);
  const layer = (s, role) => (
    <div
      key={role === 'enter' ? `in-${t.seq}` : `out-${t.seq}`}
      className={cn('present-layer', leavingSlide && `present-${transition}-${role}`)}
      style={{ '--dir': t.dir }}
      onAnimationEnd={role === 'enter' ? t.done : undefined}
    >
      <div className="artboard-scaler" style={{ transform: `scale(${scale})` }}>
        <SlideRenderer slide={s} theme={theme} />
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={cn('present-root', idle && 'idle')}
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting slide ${t.index + 1} of ${order.length}`}
      onClick={() => advance(pos.current)}
    >
      <div
        className="relative overflow-hidden"
        style={{ width: ARTBOARD_W * scale, height: ARTBOARD_H * scale }}
      >
        {leavingSlide && layer(leavingSlide, 'exit')}
        {layer(slide, 'enter')}
      </div>

      {showNotes && (
        <div
          className="present-notes absolute inset-x-6 bottom-16 mx-auto max-h-[32vh] max-w-3xl animate-in overflow-y-auto rounded-lg bg-black/80 px-5 py-4 text-base leading-relaxed text-white/90 shadow-float duration-base ease-enter fade-in-0 slide-in-from-bottom-2"
          onClick={(e) => e.stopPropagation()}
          aria-label="Speaker notes"
        >
          <p className="mb-1 text-label tracking-wide text-white/50 uppercase">
            Notes · slide {t.index + 1}
          </p>
          {slide.notes ? (
            <p className="whitespace-pre-line">{slide.notes}</p>
          ) : (
            <p className="text-white/50">No notes for this slide.</p>
          )}
        </div>
      )}

      <div
        className="present-hud absolute right-4 bottom-4 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-ui text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={showNotes ? 'Hide speaker notes (N)' : 'Show speaker notes (N)'}
          aria-pressed={showNotes}
          className={cn('mr-1 rounded-full p-1.5 hover:bg-white/15', showNotes && 'bg-white/20')}
          onClick={() => setShowNotes((v) => !v)}
        >
          <NotebookPen className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Previous slide"
          className="rounded-full p-1.5 hover:bg-white/15"
          onClick={() => go(pos.current - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-1 tabular-nums">
          {t.index + 1} / {order.length}
        </span>
        <button
          type="button"
          aria-label={t.index + 1 >= order.length ? 'End presentation' : 'Next slide'}
          className="rounded-full p-1.5 hover:bg-white/15"
          onClick={() => advance(pos.current)}
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Exit presentation"
          className="ml-1 rounded-full p-1.5 hover:bg-white/15"
          onClick={exit}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
