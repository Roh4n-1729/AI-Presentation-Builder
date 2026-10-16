import { useState } from 'react';
import { getDeckState } from '@/hooks/useDeck.js';

/** What the AI changed, as clickable chips (D11): click = select, scroll to and flash it. */
export function OpChips({ chips }) {
  const [all, setAll] = useState(false);
  if (!chips?.length) return null;
  const many = chips.length > 8 && !all;
  const shown = many ? chips.slice(0, 8) : chips;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((c, i) => (
        <button
          key={i}
          type="button"
          disabled={!c.slideId}
          onClick={() => getDeckState().showInCanvas(c)}
          title={c.slideId ? 'Show in the slide' : undefined}
          className="flex animate-in items-center gap-1.5 rounded-md border border-l-[3px] border-l-ai bg-panel py-1 pr-2 pl-1.5 text-label text-foreground transition-colors duration-fast fade-in-0 hover:bg-ai-soft disabled:cursor-default disabled:opacity-60"
          style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
        >
          {c.label}
        </button>
      ))}
      {many && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-md px-1.5 py-1 text-label text-muted-foreground hover:bg-subtle hover:text-foreground"
        >
          Show all {chips.length}
        </button>
      )}
    </div>
  );
}
