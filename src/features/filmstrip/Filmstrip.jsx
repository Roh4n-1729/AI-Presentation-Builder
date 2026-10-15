import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Plus } from 'lucide-react';
import { getDeckState, useDeck, useDeckActions } from '@/hooks/useDeck.js';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { getTheme } from '@/lib/theme/index.js';
import { Button } from '@/primitives/ui/button.jsx';
import { ThumbPreview, Thumbnail } from './Thumbnail.jsx';

function SortableThumbnail({ slideId, index, theme }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slideId,
  });
  return (
    <Thumbnail
      slideId={slideId}
      index={index}
      theme={theme}
      placeholder={isDragging}
      sortable={{
        setNodeRef,
        attributes,
        listeners,
        style: { transform: CSS.Transform.toString(transform), transition },
      }}
    />
  );
}

/**
 * Slide navigator. Drag to reorder (dnd-kit sortable): the lifted slide follows the pointer in an
 * overlay while a dashed slot shows exactly where it will land. Keyboard reorder works too
 * (focus a thumbnail, Space, arrows, Space). On drop the index becomes an anchor op (D24).
 */
export function Filmstrip() {
  const slideOrder = useDeck((s) => s.deck.slideOrder);
  const themeId = useDeck((s) => s.deck.theme);
  const { moveSlideToIndex, addBlankSlide } = useDeckActions();
  const { goToStart } = useWorkspace();
  const aiBusy = useDeck((s) => s.aiBusy);
  const scheme = useDeck((s) => s.colorScheme);
  const theme = getTheme(themeId, scheme);
  const [draggingId, setDraggingId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // a click navigates, a drag reorders
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const draggingSlide = useDeck((s) => (draggingId ? s.deck.slides[draggingId] : null));

  return (
    <aside className="flex w-[244px] shrink-0 flex-col border-r bg-panel" aria-label="Slides">
      <div className="flex h-11 shrink-0 items-center border-b px-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-0.5 rounded-md text-muted-foreground hover:text-foreground"
          disabled={aiBusy}
          onClick={goToStart}
        >
          <ArrowLeft strokeWidth={1.75} /> All presentations
        </Button>
        <span className="ml-auto pr-1 text-label text-faint tabular-nums">
          {slideOrder.length} slide{slideOrder.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setDraggingId(active.id)}
          onDragCancel={() => setDraggingId(null)}
          onDragEnd={({ active, over }) => {
            setDraggingId(null);
            if (!over || active.id === over.id) return;
            moveSlideToIndex(active.id, getDeckState().deck.slideOrder.indexOf(over.id));
          }}
        >
          <SortableContext items={slideOrder} strategy={verticalListSortingStrategy}>
            {slideOrder.map((id, i) => (
              <SortableThumbnail key={id} slideId={id} index={i} theme={theme} />
            ))}
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
            {draggingSlide ? (
              <div className="pl-7">
                <ThumbPreview
                  slide={draggingSlide}
                  theme={theme}
                  className="rotate-1 shadow-float ring-2 ring-user"
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => addBlankSlide(slideOrder.at(-1) ?? null)}
        >
          <Plus strokeWidth={1.5} /> Add slide
        </Button>
      </div>
    </aside>
  );
}
