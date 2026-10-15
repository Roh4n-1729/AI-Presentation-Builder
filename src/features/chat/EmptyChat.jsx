import { LayoutTemplate } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { Button } from '@/primitives/ui/button.jsx';

const GENERATE_EXAMPLES = [
  'A 6-slide pitch for a neighbourhood composting startup, with a market-size chart',
  'Quarterly business review for a SaaS company: revenue, churn, roadmap',
  'Intro to monsoon farming in Maharashtra for first-year agriculture students',
];
const EDIT_EXAMPLES = [
  'Make slide 2 more concise',
  'Turn the revenue numbers into a line chart',
  'Add a closing slide with three next steps',
];

/** First-run state: what the AI can do, with prompts to start from. */
export function EmptyChat({ deckEmpty, onExample }) {
  const { startFromSample } = useWorkspace();
  const examples = deckEmpty ? GENERATE_EXAMPLES : EDIT_EXAMPLES;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-10 pb-4">
      <div className="space-y-2">
        <p className="font-display text-[28px] leading-tight">
          {deckEmpty ? 'What are we presenting?' : 'What should change?'}
        </p>
        <p className="text-ui text-muted-foreground">
          {deckEmpty
            ? 'Describe the deck and the AI builds it slide by slide. Every slide stays editable.'
            : 'Ask for edits in plain words. Select an element first to point at it. Each change shows up as a chip you can click, and one Undo reverts the whole turn.'}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <p className="text-label font-medium tracking-wide text-muted-foreground uppercase">Try</p>
        {examples.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onExample(t)}
            className="rounded-lg border bg-panel px-3 py-2 text-left text-ui transition-colors duration-120 hover:border-ai/40 hover:bg-ai-soft"
          >
            {t}
          </button>
        ))}
      </div>
      {deckEmpty && (
        <Button variant="secondary" size="sm" className="self-start" onClick={startFromSample}>
          <LayoutTemplate strokeWidth={1.5} /> Open the sample deck
        </Button>
      )}
    </div>
  );
}
