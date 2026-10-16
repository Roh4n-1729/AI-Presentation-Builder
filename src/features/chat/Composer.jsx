import { useLayoutEffect, useRef } from 'react';
import { ArrowUp, MousePointer2, Square, X } from 'lucide-react';
import { useAi } from '@/hooks/useAi.js';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { findElement } from '@/lib/ops/index.js';
import { Button } from '@/primitives/ui/button.jsx';

const SLIDE_COUNTS = ['auto', 4, 5, 6, 7, 8, 10, 12];
const MAX_ROWS_PX = 160;
const TEXT_NAMES = { title: 'title', subtitle: 'subtitle', body: 'text box', caption: 'caption' };

/** "chart on slide 2" / "3 elements on slide 2": what the AI will treat as "this". */
function useSelectionLabel() {
  return useDeck((s) => {
    if (!s.selection.length) return null;
    const hit = findElement(s.deck, s.selection[0]);
    if (!hit) return null;
    const n = s.deck.slideOrder.indexOf(hit.slide.id) + 1;
    if (s.selection.length > 1) return `${s.selection.length} elements on slide ${n}`;
    const what = hit.el.type === 'text' ? (TEXT_NAMES[hit.el.role] ?? 'text box') : hit.el.type;
    return `${what} on slide ${n}`;
  });
}

/**
 * The input: Enter sends, Shift+Enter adds a line, Stop while a run streams. The chat edits the
 * open deck; it only builds a deck when the deck is still empty ("Start blank"). New decks start
 * from the "New" button (D40).
 */
export function Composer({ draft, setDraft, mode }) {
  const ai = useAi();
  const aiBusy = useDeck((s) => s.aiBusy);
  const selectionLabel = useSelectionLabel();
  const slideCountRef = useRef(null);
  const taRef = useRef(null);

  // Auto-grow up to a cap, then scroll.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_ROWS_PX)}px`;
  }, [draft]);

  const send = () => {
    const text = draft.trim();
    if (!text || aiBusy) return;
    setDraft('');
    if (mode === 'generate') {
      const v = slideCountRef.current?.value;
      ai.generateDeck({ prompt: text, slideCount: v && v !== 'auto' ? Number(v) : undefined });
    } else {
      ai.runEdit(text);
    }
  };

  return (
    <div className="shrink-0 border-t p-3">
      {mode === 'generate' && (
        <div className="mb-2 flex items-center gap-2 text-label text-muted-foreground">
          <span>This deck is empty: describe it and the AI builds it.</span>
          <label className="ml-auto flex items-center gap-1.5">
            Slides
            <select
              ref={slideCountRef}
              defaultValue="auto"
              disabled={aiBusy}
              className="rounded-sm border bg-panel px-1 py-0.5 text-label text-foreground"
            >
              {SLIDE_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n === 'auto' ? 'Auto' : n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {mode === 'edit' && selectionLabel && (
        <div className="mb-2 flex w-fit items-center gap-1.5 rounded-full bg-user-soft py-0.5 pr-1 pl-2 text-label text-user">
          <MousePointer2 className="size-3" strokeWidth={1.75} />
          {selectionLabel}
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => getDeckState().select(null)}
            className="rounded-full p-0.5 hover:bg-user/15"
          >
            <X className="size-3" strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border bg-panel p-2 focus-within:ring-2 focus-within:ring-ring/40">
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            mode === 'generate'
              ? 'Describe the presentation…'
              : selectionLabel
                ? `What should change about the ${selectionLabel.split(' on ')[0]}?`
                : 'Ask for a change…'
          }
          aria-label={mode === 'generate' ? 'Describe the new deck' : 'Ask the AI to edit the deck'}
          className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-ui leading-5 outline-none placeholder:text-faint"
        />
        {aiBusy ? (
          <Button size="icon-sm" variant="secondary" aria-label="Stop" onClick={ai.stop}>
            <Square className="size-3.5 fill-current" strokeWidth={1.5} />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            aria-label={mode === 'generate' ? 'Generate deck' : 'Send'}
            disabled={!draft.trim()}
            onClick={send}
            className="bg-ai text-white hover:bg-ai/90"
          >
            <ArrowUp strokeWidth={2} />
          </Button>
        )}
      </div>
    </div>
  );
}
