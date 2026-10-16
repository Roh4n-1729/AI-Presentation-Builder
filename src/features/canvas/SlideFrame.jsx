import { memo, useMemo, useRef, useState } from 'react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { cn } from '@/primitives/cn.js';
import { DropRing } from '@/primitives/DropRing.jsx';
import { SlideInteractionContext } from '@/features/slide/interaction.js';
import { ElementView } from '@/features/slide/ElementView.jsx';
import { SlideRenderer } from '@/features/slide/SlideRenderer.jsx';
import { CanvasMoveable } from './CanvasMoveable.jsx';
import { FloatingToolbar } from './FloatingToolbar.jsx';
import { pendingDrag } from './pendingDrag.js';
import { useAiMotion } from './useAiMotion.js';
import { useMarquee } from './useMarquee.js';

/** Editor callbacks for the renderer. Built once: handlers read fresh state at call time. */
function useInteraction() {
  return useMemo(
    () => ({
      onElementPointerDown(e, el) {
        e.stopPropagation();
        const s = getDeckState();
        const alreadySelected = s.selection.includes(el.id);
        // Gotcha 5: pressing an element that's already in the group keeps the group.
        if (e.shiftKey || !alreadySelected) s.select(el.id, e.shiftKey);
        // Gotcha 2: click-and-drag in one motion; Moveable picks this up once it mounts.
        if (!alreadySelected && !e.shiftKey) pendingDrag.set(el.id, e.nativeEvent);
      },
      onElementDoubleClick(el) {
        // Charts have no inline editing: their data opens in the drawer.
        if (el.type === 'chart') getDeckState().openDrawer(el.id);
        else getDeckState().setEditing(el.id);
      },
      commitText(el, paragraphs) {
        const s = getDeckState();
        s.setEditing(null);
        if (JSON.stringify(paragraphs) !== JSON.stringify(el.paragraphs)) {
          s.dispatch(
            { type: 'update_element', elementId: el.id, patch: { paragraphs } },
            { label: 'Edit text' },
          );
        }
      },
      commitCell(el, r, c, value) {
        const s = getDeckState();
        const current = s.deck.slides[findSlideId(s.deck, el.id)]?.elements[el.id];
        if (!current || current.rows[r]?.[c] === value) return;
        const rows = current.rows.map((row) => [...row]);
        rows[r][c] = value;
        s.dispatch(
          { type: 'update_element', elementId: el.id, patch: { rows } },
          { label: 'Edit table cell' },
        );
      },
      endEdit() {
        getDeckState().setEditing(null);
      },
    }),
    [],
  );
}

const findSlideId = (deck, elId) => deck.slideOrder.find((sid) => deck.slides[sid].elements[elId]);

/** One live, editable 16:9 slide in the column. */
export const SlideFrame = memo(function SlideFrame({ slideId, index, scale, theme }) {
  const slide = useDeck((s) => s.deck.slides[slideId]);
  const drop = useDeck((s) => (s.dropTarget?.slideId === slideId ? s.dropTarget : null));
  const isDragging = useDeck((s) => s.draggingSlideId === slideId);
  const reveal = useDeck((s) => (s.reveal?.slideId === slideId ? s.reveal : null));
  const aiFlash = useDeck((s) => s.aiFlash[slideId]);
  const isActive = useDeck((s) => s.activeSlideId === slideId);
  const editingId = useDeck((s) => s.editingId);
  // While presenting, the editor's handles and toolbar unmount (Moveable draws its control box
  // in a high layer that would otherwise float over the presentation). Selection is kept, so the
  // editor comes back exactly as it was after Esc.
  const presenting = useDeck((s) => Boolean(s.presenting));
  const interaction = useInteraction();
  const frameRef = useRef(null);
  const marquee = useMarquee(frameRef, slideId, scale);
  const artboardRef = useRef(null);
  const { ghosts, dropGhost } = useAiMotion(slide, aiFlash, artboardRef);
  // A slide the AI adds mid-turn rises into place; slides present at load just appear.
  const [aiEntered] = useState(() => getDeckState().aiBusy);
  if (!slide) return null;
  const editingHere = editingId && slide.elements[editingId] ? editingId : null;

  return (
    <div
      ref={frameRef}
      data-slide-frame={slideId}
      aria-label={`Slide ${index + 1}: ${slide.title}`}
      className={cn(
        'slide-frame relative shrink-0 rounded-md bg-panel shadow-[var(--slide-shadow)] transition-shadow duration-fast',
        isActive && 'shadow-[var(--slide-shadow-active)]',
        isDragging && 'dragging',
        aiEntered && 'animate-in duration-move ease-enter fade-in-0 slide-in-from-bottom-4',
      )}
      style={{ width: ARTBOARD_W * scale, height: ARTBOARD_H * scale }}
      // Gotcha 4: only a press on the slide background itself deselects; dragging from the
      // background draws a selection box (useMarquee).
      onPointerDown={marquee.onPointerDown}
      // Clicking anywhere on a slide makes it the current one, before elements stop the event:
      // paste, Insert and "Present from this slide" then use the slide that was clicked, not
      // whichever the scroll tracker last picked (D53).
      onPointerDownCapture={() => getDeckState().setActiveSlide(slideId)}
    >
      <span className="absolute top-0 -left-9 text-ui font-medium text-faint tabular-nums">
        {index + 1}
      </span>
      <div className="artboard-scaler" style={{ transform: `scale(${scale})` }}>
        <SlideInteractionContext.Provider value={interaction}>
          <SlideRenderer
            slide={slide}
            theme={theme}
            editingId={editingHere}
            artboardRef={artboardRef}
          />
        </SlideInteractionContext.Provider>
        {ghosts.length > 0 && (
          // Elements an AI op just deleted, fading out where they were (read-only, no context).
          <div aria-hidden className="ai-ghosts">
            {ghosts.map((g) => (
              <div key={g.key} className="ai-ghost" onAnimationEnd={() => dropGhost(g.key)}>
                <ElementView el={g.el} theme={theme} />
              </div>
            ))}
          </div>
        )}
      </div>
      {!presenting && (
        <>
          <CanvasMoveable
            slide={slide}
            frameRef={frameRef}
            artboardRef={artboardRef}
            scale={scale}
          />
          <FloatingToolbar slide={slide} scale={scale} theme={theme} />
        </>
      )}
      {marquee.rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-20 rounded-[2px] border border-user bg-user/10"
          style={{
            left: marquee.rect.x,
            top: marquee.rect.y,
            width: marquee.rect.w,
            height: marquee.rect.h,
          }}
        />
      )}
      {drop && <DropRing label={`${drop.copy ? 'Copy' : 'Move'} to slide ${index + 1}`} />}
      {reveal && <RevealFlash key={reveal.seq} reveal={reveal} slide={slide} scale={scale} />}
      {aiFlash?.elementIds.length > 0 && (
        <RevealFlash key={`ai${aiFlash.seq}`} reveal={aiFlash} slide={slide} scale={scale} ai />
      )}
    </div>
  );
});

/**
 * A short flash on what changed: indigo after undo/redo (the user's color), saffron where an AI
 * op just landed (D17). Element boxes when we know them, otherwise the whole slide. Screen-space
 * overlay next to the renderer, never inside it (D6).
 */
function RevealFlash({ reveal, slide, scale, ai = false }) {
  const cls = ai ? 'reveal-flash ai-flash' : 'reveal-flash';
  const boxes = reveal.elementIds.map((id) => slide.elements[id]?.bbox).filter(Boolean);
  if (boxes.length === 0)
    return <div aria-hidden className={cn(cls, '-inset-[5px] rounded-[13px]')} />;
  return boxes.map((b, i) => (
    <div
      key={i}
      aria-hidden
      className={cn(cls, 'rounded-sm')}
      style={{
        left: b.x * scale - 4,
        top: b.y * scale - 4,
        width: b.w * scale + 8,
        height: b.h * scale + 8,
      }}
    />
  ));
}
