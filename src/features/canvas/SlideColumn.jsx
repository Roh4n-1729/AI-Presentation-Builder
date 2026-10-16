import { useEffect, useRef } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { useActiveSlideTracker } from '@/hooks/useActiveSlideTracker.js';
import { useDeck, useDeckActions } from '@/hooks/useDeck.js';
import { useFitScale } from '@/hooks/useFitScale.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { getTheme } from '@/lib/theme/index.js';
import { Button } from '@/primitives/ui/button.jsx';
import { InsertBetween } from './InsertBetween.jsx';
import { SlideNotes } from './SlideNotes.jsx';
import { SlideFrame } from './SlideFrame.jsx';
import './canvas.css';

/** Gamma-style continuous column of live slides (D8): the adjacent slide is always a drop target. */
export function SlideColumn() {
  const paneRef = useRef(null);
  const scale = useFitScale(paneRef);
  const slideOrder = useDeck((s) => s.deck.slideOrder);
  const themeId = useDeck((s) => s.deck.theme);
  const { addBlankSlide } = useDeckActions();
  const scheme = useDeck((s) => s.colorScheme);
  const theme = getTheme(themeId, scheme);
  const reveal = useDeck((s) => s.reveal);
  const aiBusy = useDeck((s) => s.aiBusy);
  useActiveSlideTracker(paneRef, slideOrder);

  // Undo/redo: bring the changed slide into view (minimal scroll; nothing if already visible).
  useEffect(() => {
    if (!reveal) return;
    const frame = paneRef.current?.querySelector(`[data-slide-frame="${reveal.slideId}"]`);
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    frame?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
  }, [reveal]);

  return (
    // `isolate`: everything on the canvas (Moveable's z-index 3000 handles, toolbar, flashes)
    // stacks inside this column, so menus and tooltips (portals on <body>) always draw above it.
    <div
      ref={paneRef}
      data-scroll-column
      className="isolate flex min-w-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto bg-canvas px-16 pt-10 pb-32"
    >
      {slideOrder.length === 0 && aiBusy ? (
        <PlanningPlaceholder scale={scale} />
      ) : slideOrder.length === 0 ? (
        <div className="mt-32 flex max-w-sm flex-col items-center gap-3 text-center">
          <LayoutTemplate className="size-10 text-faint" strokeWidth={1.25} />
          <p className="font-display text-[28px] leading-tight">No slides yet</p>
          <p className="text-ui text-muted-foreground">
            Add a blank slide, or describe a deck in the chat and the AI builds it.
          </p>
          <Button variant="secondary" onClick={() => addBlankSlide(null)}>
            Add a slide
          </Button>
        </div>
      ) : (
        slideOrder.map((id, i) => (
          <div key={id} className="flex flex-col items-center">
            <SlideFrame slideId={id} index={i} scale={scale} theme={theme} />
            <SlideNotes slideId={id} scale={scale} />
            <InsertBetween afterSlideId={id} />
          </div>
        ))
      )}
    </div>
  );
}

/** While the AI plans a new deck (before any slide exists): ghost frames in the AI's color. */
function PlanningPlaceholder({ scale }) {
  return (
    <div className="flex flex-col items-center gap-10" aria-live="polite">
      <p className="text-ui text-muted-foreground">Planning the outline…</p>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-md border border-dashed border-ai/40 bg-ai-soft/40"
          style={{
            width: ARTBOARD_W * scale,
            height: ARTBOARD_H * scale,
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}
    </div>
  );
}
