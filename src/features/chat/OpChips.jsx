import { getDeckState } from '@/hooks/useDeck.js';

/** What the AI changed, as clickable chips (D11): click = select, scroll to and flash it. */
export function OpChips({ chips }) {
  if (!chips?.length) return null;
  const many = chips.length > 8;
  const shown = many ? chips.slice(0, 8) : chips;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((c, i) => (
        <button
          key={i}
          type="button"
          disabled={!c.slideId}
          onClick={() => getDeckState().showInCanvas(c)}
          className="animate-in rounded-full bg-ai-soft px-2.5 py-1 text-label font-medium text-ai transition-colors duration-120 fade-in-0 hover:bg-ai/20 disabled:cursor-default disabled:opacity-60"
          style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
        >
          {c.label}
        </button>
      ))}
      {many && (
        <span className="px-1 py-1 text-label text-muted-foreground">+{chips.length - 8} more</span>
      )}
    </div>
  );
}
