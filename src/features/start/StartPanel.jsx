import { useRef, useState } from 'react';
import { ChevronDown, FilePlus2, FolderOpen, LayoutTemplate, Sparkles } from 'lucide-react';
import { useAi } from '@/hooks/useAi.js';
import { useDeck } from '@/hooks/useDeck.js';
import { useFeedback } from '@/hooks/useFeedback.js';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { cn } from '@/primitives/cn.js';
import { Button } from '@/primitives/ui/button.jsx';
import { Kbd, KbdGroup } from '@/primitives/ui/kbd.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';
import { ColorSchemeToggle } from '@/features/topbar/ColorSchemeToggle.jsx';
import { RecentProjects } from './RecentProjects.jsx';

const SLIDE_COUNTS = ['auto', 4, 5, 6, 7, 8, 10, 12];

const EXAMPLES = [
  {
    label: 'Quarterly review with a chart and a table',
    prompt:
      'Q3 business review for a B2B SaaS startup: revenue by month as a chart, a table comparing plans, key wins and next quarter goals',
  },
  {
    label: 'Startup pitch',
    prompt:
      'A pitch deck for a neighbourhood composting startup in Pune: problem, solution, market size chart, business model, team, ask',
  },
  {
    label: 'Class lecture',
    prompt:
      'An introductory lecture on how monsoons work, for first-year geography students, with a rainfall chart',
  },
  {
    label: 'Project kickoff',
    prompt:
      'Kickoff for migrating our web app to a new design system: goals, timeline table, risks, owners',
  },
];

/**
 * The StartScreen: one big prompt box. Generate goes straight to the editor, where the outline,
 * skeleton slides and progress appear (no approval step, D12).
 */
export function StartPanel() {
  const ai = useAi();
  const { startBlank, startFromSample, prepareForGeneration, importDeckFile } = useWorkspace();
  const fileRef = useRef(null);
  const hasRecent = useDeck((s) => s.recentProjects.length > 0);
  const feedback = useFeedback();
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState('auto');
  const taRef = useRef(null);

  const generate = () => {
    const text = prompt.trim();
    if (!text) {
      taRef.current?.focus();
      return;
    }
    const slideCount = count === 'auto' ? undefined : Number(count);
    prepareForGeneration().then(() => ai.generateDeck({ prompt: text, slideCount }));
  };

  return (
    // With saved presentations the prompt sits high so "Recent" has room below; without them the
    // heading and prompt are one block centred in the page, a little above the middle (D69).
    // my-auto rather than justify-center: a short window still scrolls instead of clipping.
    <main
      className={cn(
        'start-wash relative flex h-full flex-col items-center overflow-y-auto px-4',
        hasRecent ? 'pt-[12vh] pb-16' : 'py-10',
      )}
    >
      {/* Same place as in the editor's top bar: the top-right corner (D71). */}
      <div className="absolute top-3 right-3">
        <ColorSchemeToggle />
      </div>
      <div className={cn('w-full max-w-[680px]', !hasRecent && 'my-auto -translate-y-[6vh]')}>
        <h1 className="text-center font-display text-display">What are we presenting?</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Describe the deck, or paste an outline. The AI plans it and builds it slide by slide;
          every slide stays editable.
        </p>

        <div className="mt-8 rounded-2xl border bg-panel p-3 shadow-float focus-within:ring-2 focus-within:ring-ring/40">
          <textarea
            ref={taRef}
            autoFocus
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                generate();
              }
            }}
            placeholder="e.g. A 6-slide pitch for a composting startup, with a market-size chart"
            aria-label="Describe your presentation"
            // Grows with the text (no resize grip in the corner above the button, D70).
            className="block field-sizing-content max-h-72 min-h-24 w-full resize-none bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-faint"
          />
          <div className="mt-2 flex items-center gap-2">
            {/* Same dropdown primitive as the rest of the app (a native <select> can't be themed). */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Slides: ${count === 'auto' ? 'Auto' : count}`}
                  className="text-muted-foreground"
                >
                  Slides
                  <span className="font-medium text-foreground tabular-nums">
                    {count === 'auto' ? 'Auto' : count}
                  </span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuRadioGroup value={String(count)} onValueChange={setCount}>
                  {SLIDE_COUNTS.map((n) => (
                    <DropdownMenuRadioItem key={n} value={String(n)}>
                      {n === 'auto' ? 'Auto' : `${n} slides`}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <KbdGroup className="ml-auto" aria-hidden>
              <Kbd>Ctrl</Kbd>
              <Kbd>Enter</Kbd>
            </KbdGroup>
            {/* The AI action (sparkle, as in the chat header and planning view), not a send arrow.
                Disabled it turns neutral instead of a faded saffron (D70). */}
            <Button
              variant="ai"
              onClick={generate}
              disabled={!prompt.trim()}
              className="px-4 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
            >
              <Sparkles strokeWidth={1.75} /> Generate
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setPrompt(ex.prompt);
                taRef.current?.focus();
              }}
              className={cn(
                'rounded-full border bg-panel/80 px-3 py-1.5 text-ui transition-colors duration-fast',
                'hover:border-ai/40 hover:bg-ai-soft',
              )}
            >
              {ex.label}
            </button>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-ui text-muted-foreground">
          <span>or</span>
          <Button variant="ghost" size="sm" onClick={startBlank}>
            <FilePlus2 strokeWidth={1.5} /> Start blank
          </Button>
          <Button variant="ghost" size="sm" onClick={startFromSample}>
            <LayoutTemplate strokeWidth={1.5} /> Open the sample deck
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <FolderOpen strokeWidth={1.5} /> Open a deck file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const res = await importDeckFile(file);
              if (!res.ok) feedback.error("Couldn't open that deck file", res.message);
            }}
          />
        </div>
      </div>
      <RecentProjects />
    </main>
  );
}
