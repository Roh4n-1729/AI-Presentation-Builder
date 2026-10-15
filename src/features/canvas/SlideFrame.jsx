import { memo, useMemo, useRef } from 'react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { cn } from '@/primitives/cn.js';
import { DropRing } from '@/primitives/DropRing.jsx';
import { SlideInteractionContext } from '@/features/slide/interaction.js';
import { SlideRenderer } from '@/features/slide/SlideRenderer.jsx';
import { CanvasMoveable } from './CanvasMoveable.jsx';
import { pendingDrag } from './pendingDrag.js';

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
        getDeckState().setEditing(el.id);
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
  const isActive = useDeck((s) => s.activeSlideId === slideId);
  const editingId = useDeck((s) => s.editingId);
  const interaction = useInteraction();
  const frameRef = useRef(null);
  const artboardRef = useRef(null);
  if (!slide) return null;
  const editingHere = editingId && slide.elements[editingId] ? editingId : null;

  return (
    <div
      ref={frameRef}
      data-slide-frame={slideId}
      aria-label={`Slide ${index + 1}: ${slide.title}`}
      className={cn(
        'slide-frame relative shrink-0 rounded-md bg-panel shadow-[0_0_0_1px_var(--border),0_8px_24px_rgb(0_0_0/0.06)] transition-shadow duration-120',
        isActive && 'shadow-[0_0_0_1px_var(--border),0_12px_32px_rgb(0_0_0/0.10)]',
        isDragging && 'dragging',
      )}
      style={{ width: ARTBOARD_W * scale, height: ARTBOARD_H * scale }}
      // Gotcha 4: only a press on the slide background itself deselects.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || e.target.classList.contains('artboard'))
          getDeckState().select(null);
      }}
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
      </div>
      <CanvasMoveable slide={slide} frameRef={frameRef} artboardRef={artboardRef} scale={scale} />
      {drop && <DropRing label={`${drop.copy ? 'Copy' : 'Move'} to slide ${index + 1}`} />}
      {reveal && <RevealFlash key={reveal.seq} reveal={reveal} slide={slide} scale={scale} />}
    </div>
  );
});

/**
 * After undo/redo: a short indigo flash on what changed (the user's color; AI changes will glow
 * saffron). Element boxes when we know them, otherwise the whole slide. Screen-space overlay
 * next to the renderer, never inside it (D6).
 */
function RevealFlash({ reveal, slide, scale }) {
  const boxes = reveal.elementIds.map((id) => slide.elements[id]?.bbox).filter(Boolean);
  if (boxes.length === 0)
    return <div aria-hidden className="reveal-flash -inset-[5px] rounded-[13px]" />;
  return boxes.map((b, i) => (
    <div
      key={i}
      aria-hidden
      className="reveal-flash rounded-sm"
      style={{
        left: b.x * scale - 4,
        top: b.y * scale - 4,
        width: b.w * scale + 8,
        height: b.h * scale + 8,
      }}
    />
  ));
}
