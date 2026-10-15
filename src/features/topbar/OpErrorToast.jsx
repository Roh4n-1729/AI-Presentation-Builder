import { useEffect } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';

/** Shows the last rejected op (e.g. "Element el_x is locked") for a few seconds. */
export function OpErrorToast() {
  const error = useDeck((s) => s.lastError);
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => getDeckState().clearError(), 4000);
    return () => clearTimeout(t);
  }, [error]);
  if (!error) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-start gap-2 rounded-lg border bg-panel px-3 py-2 text-ui shadow-float"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.5} />
      <span>
        <span className="font-medium">{error.label} failed.</span> {error.message}
      </span>
      <button
        aria-label="Dismiss"
        className="ml-1 text-muted-foreground hover:text-foreground"
        onClick={() => getDeckState().clearError()}
      >
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
