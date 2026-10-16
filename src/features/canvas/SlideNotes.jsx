import { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { useDeck, useDeckActions } from '@/hooks/useDeck.js';
import { ARTBOARD_W } from '@/lib/constants.js';
import { cn } from '@/primitives/cn.js';

const MAX = 5000; // schema limit (lib/schema/deck.js)

/**
 * Speaker notes under each slide on the canvas (D48). Collapsed it's a one-line hint, or the
 * first lines of the notes; click to edit. The textarea is uncontrolled and commits on blur as one
 * undoable op ("Edit speaker notes"); Esc restores what was there. Notes go to Present (N) and to
 * the PowerPoint notes pane on export.
 */
export function SlideNotes({ slideId, scale }) {
  const notes = useDeck((s) => s.deck.slides[slideId]?.notes ?? '');
  const aiBusy = useDeck((s) => s.aiBusy);
  const { setSlideNotes } = useDeckActions();
  const [editing, setEditing] = useState(false);
  const width = ARTBOARD_W * scale;

  if (editing) {
    return (
      <div style={{ width }} className="mt-3">
        <label className="mb-3 flex items-center gap-1.5 text-label text-muted-foreground">
          <NotebookPen className="size-3.5" strokeWidth={1.5} />
          Speaker notes
          <span className="ml-auto text-faint">Esc to cancel · click away to save</span>
        </label>
        <textarea
          autoFocus
          defaultValue={notes}
          maxLength={MAX}
          aria-label="Speaker notes"
          placeholder="What you'll say on this slide…"
          className={cn(
            'block field-sizing-content max-h-72 min-h-20 w-full resize-none rounded-md border bg-panel px-3 py-2 text-ui leading-relaxed outline-none',
            'focus:ring-2 focus:ring-ring/40',
            'animate-in duration-base ease-enter fade-in-0 slide-in-from-top-1',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation(); // not a canvas deselect
              e.currentTarget.value = notes;
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const next = e.currentTarget.value.replace(/\s+$/, '');
            setEditing(false);
            if (next !== notes) setSlideNotes(slideId, next);
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      style={{ width }}
      disabled={aiBusy}
      onClick={() => setEditing(true)}
      className={cn(
        'mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-label transition-colors duration-fast ease-standard',
        'hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none',
        notes ? 'text-muted-foreground' : 'text-faint',
      )}
    >
      <NotebookPen className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
      {notes ? (
        <span className="line-clamp-2 whitespace-pre-line">{notes}</span>
      ) : (
        <span>Add speaker notes</span>
      )}
    </button>
  );
}
