import { memo, useEffect, useState } from 'react';
import { CircleAlert, RotateCcw, Undo2 } from 'lucide-react';
import { useAi } from '@/hooks/useAi.js';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { Button } from '@/primitives/ui/button.jsx';
import { OpChips } from './OpChips.jsx';

function Countdown({ seconds, children }) {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    if (!left) return undefined;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return children(left);
}

/** One AI reply: live activity, outline + progress (generation), op chips, summary, actions. */
export const AssistantMessage = memo(function AssistantMessage({ msg, isLast }) {
  const ai = useAi();
  const aiBusy = useDeck((s) => s.aiBusy);
  // "Undo this" only while this turn is the newest history entry (D10, D25). A generation is
  // not undone this way: undoing it would just empty the new deck.
  const canUndo = useDeck(
    (s) =>
      msg.kind !== 'generate' && !s.aiBusy && msg.turnId && s.past.at(-1)?.turnId === msg.turnId,
  );
  const streaming = msg.status === 'streaming';

  return (
    <div className="space-y-2 text-ui">
      {msg.outline && (
        <div className="rounded-lg border bg-subtle/60 p-3">
          <p className="mb-1.5 text-label font-medium tracking-wide text-muted-foreground uppercase">
            Outline
          </p>
          <ol className="list-decimal space-y-0.5 pl-4">
            {msg.outline.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
          {msg.progress && (
            <div className="mt-2.5">
              <div className="h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-ai transition-[width] duration-move ease-standard"
                  style={{ width: `${(msg.progress.done / msg.progress.total) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-label text-muted-foreground">
                {msg.progress.done} of {msg.progress.total} slides filled
              </p>
            </div>
          )}
        </div>
      )}

      {msg.text && <p className="whitespace-pre-wrap text-muted-foreground">{msg.text.trim()}</p>}

      <OpChips chips={msg.chips} />
      {msg.skipped > 0 && (
        <p className="text-label text-muted-foreground">
          Skipped {msg.skipped} change{msg.skipped > 1 ? 's' : ''}: the target was edited or deleted
          meanwhile.
        </p>
      )}

      {streaming && (
        <p className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ai/60" />
            <span className="relative inline-flex size-2 rounded-full bg-ai" />
          </span>
          {msg.activity ?? 'Working'}…
        </p>
      )}

      {msg.summary && !streaming && <p className="font-medium">{msg.summary}</p>}

      {msg.status === 'stopped' && !msg.summary && (
        <p className="text-muted-foreground">Stopped. Changes that already landed are kept.</p>
      )}

      {msg.error && (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.5} />
          <div className="min-w-0 flex-1 space-y-2">
            <p>{msg.error.message}</p>
            {msg.retry && (
              <Countdown seconds={msg.error.retryAfter}>
                {(left) => (
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={aiBusy || left > 0}
                    onClick={() =>
                      msg.retry.kind === 'edit'
                        ? ai.runEdit(msg.retry.text)
                        : msg.retry.kind === 'generate'
                          ? ai.generateDeck({
                              prompt: msg.retry.prompt,
                              slideCount: msg.retry.slideCount,
                            })
                          : ai.continueGeneration(msg.id)
                    }
                  >
                    <RotateCcw strokeWidth={1.5} />{' '}
                    {left > 0
                      ? `Retry in ${left}s`
                      : msg.retry.kind === 'populate'
                        ? 'Retry empty slides'
                        : 'Retry'}
                  </Button>
                )}
              </Countdown>
            )}
          </div>
        </div>
      )}

      {!streaming && msg.status === 'stopped' && msg.retry && !msg.error && (
        <Button
          size="xs"
          variant="secondary"
          disabled={aiBusy}
          onClick={() => ai.continueGeneration(msg.id)}
        >
          Continue building
        </Button>
      )}

      {!streaming && (
        <div className="flex flex-wrap items-center gap-1.5">
          {canUndo && (
            <Button size="xs" variant="ghost" onClick={() => getDeckState().undo()}>
              <Undo2 strokeWidth={1.5} /> Undo this
            </Button>
          )}
        </div>
      )}

      {isLast && !streaming && msg.suggestions?.length > 0 && (
        <div className="flex flex-col items-start gap-1.5 pt-1">
          {msg.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={aiBusy}
              onClick={() => ai.runEdit(s)}
              className="rounded-full border bg-panel px-3 py-1 text-left text-label transition-colors duration-fast hover:border-ai/40 hover:bg-ai-soft disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
