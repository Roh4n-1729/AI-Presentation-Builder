import { memo, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { useDeck, useDeckActions } from '@/hooks/useDeck.js';
import { scrollToSlide } from '@/hooks/dom.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { cn } from '@/primitives/cn.js';
import { DropRing } from '@/primitives/DropRing.jsx';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { SlideRenderer } from '@/features/slide/SlideRenderer.jsx';

// 176 × 99: whole pixels (184 gave 103.5, and at Windows display scaling the ring and the
// slide edge rounded differently, leaving a visible gap between them).
export const THUMB_W = 176;
const THUMB_H = (THUMB_W * ARTBOARD_H) / ARTBOARD_W;
const THUMB_SCALE = THUMB_W / ARTBOARD_W;

/**
 * Static mini slide (same renderer, no interaction). Also used in the drag overlay. The selection
 * ring replaces the slide edge on this same element, so ring and content always line up.
 */
export function ThumbPreview({ slide, theme, active, className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-panel transition-shadow duration-fast',
        active ? 'shadow-[0_0_0_2px_var(--user)]' : 'shadow-[var(--slide-edge)]',
        className,
      )}
      style={{ width: THUMB_W, height: THUMB_H }}
    >
      <div
        className="artboard-scaler pointer-events-none"
        style={{ transform: `scale(${THUMB_SCALE})` }}
      >
        <SlideRenderer slide={slide} theme={theme} />
      </div>
    </div>
  );
}

/**
 * One filmstrip entry. Three jobs: click to navigate, drag to reorder (dnd-kit listeners from the
 * parent), and act as a drop target for elements dragged off the canvas (`data-slide-drop`).
 */
export const Thumbnail = memo(function Thumbnail({ slideId, index, theme, sortable, placeholder }) {
  const slide = useDeck((s) => s.deck.slides[slideId]);
  const active = useDeck((s) => s.activeSlideId === slideId);
  const drop = useDeck((s) => (s.dropTarget?.slideId === slideId ? s.dropTarget : null));
  const { duplicateSlide, deleteSlide, renameSlide } = useDeckActions();
  const [renaming, setRenaming] = useState(false);
  if (!slide) return null;

  const stop = (e) => e.stopPropagation(); // keep button presses from starting a reorder drag

  return (
    <div
      ref={sortable?.setNodeRef}
      data-slide-drop={slideId}
      style={sortable?.style}
      className={cn(
        'group relative flex gap-2 rounded-lg p-1.5 outline-none',
        // While reordering, the item sits at its future position: this dashed slot IS the insertion indicator.
        placeholder &&
          'opacity-100 [&_.thumb-box]:opacity-30 [&_.thumb-box]:outline-2 [&_.thumb-box]:outline-user [&_.thumb-box]:outline-dashed',
      )}
      {...(sortable?.attributes ?? {})}
      {...(sortable?.listeners ?? {})}
      onClick={() => scrollToSlide(slideId)}
    >
      <span
        className={cn(
          'w-4 pt-0.5 text-right text-label tabular-nums',
          active ? 'text-foreground' : 'text-faint',
        )}
      >
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className="thumb-box relative rounded-md">
          <ThumbPreview slide={slide} theme={theme} active={active} />
          {drop && (
            <DropRing
              compact
              label={`${drop.copy ? 'Copy' : 'Move'} to slide ${index + 1}`}
              className="-inset-[4px] rounded-[11px]"
            />
          )}
        </div>
        {renaming ? (
          <input
            autoFocus
            defaultValue={slide.title}
            aria-label="Slide title"
            style={{ width: THUMB_W }}
            className="mt-2 rounded-sm border bg-panel px-1.5 py-0.5 text-label outline-none focus:ring-2 focus:ring-ring/50"
            onPointerDown={stop}
            onClick={stop}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                e.currentTarget.value = slide.title;
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              setRenaming(false);
              const title = e.currentTarget.value.trim();
              if (title && title !== slide.title) renameSlide(slideId, title);
            }}
          />
        ) : (
          <p
            style={{ width: THUMB_W }}
            className="mt-2 truncate text-label text-muted-foreground"
            title="Double-click to rename"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenaming(true);
            }}
          >
            {slide.title}
          </p>
        )}
      </div>
      <div
        className={cn(
          'absolute top-2.5 right-2.5 flex gap-0.5 rounded-md bg-panel/90 opacity-0 shadow-float transition-opacity duration-fast group-hover:opacity-100 focus-within:opacity-100',
          drop && 'hidden',
        )}
        onPointerDown={stop}
        onClick={stop}
      >
        <IconButtonTip
          icon={Copy}
          label="Duplicate slide"
          className="size-7"
          onClick={() => duplicateSlide(slideId)}
        />
        <IconButtonTip
          icon={Trash2}
          label="Delete slide"
          className="size-7"
          onClick={() => deleteSlide(slideId)}
        />
      </div>
    </div>
  );
});
