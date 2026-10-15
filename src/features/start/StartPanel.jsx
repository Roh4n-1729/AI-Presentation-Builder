import { useRef, useState } from 'react';
import { ArrowUp, FilePlus2, FolderOpen, LayoutTemplate } from 'lucide-react';
import { useAi } from '@/hooks/useAi.js';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { cn } from '@/primitives/cn.js';
import { Button } from '@/primitives/ui/button.jsx';
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
    <main className="start-wash relative flex h-full flex-col items-center overflow-y-auto px-4 pt-[12vh] pb-16">
      <div className="w-full max-w-[680px]">
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
            className="block max-h-72 min-h-24 w-full resize-y bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-faint"
          />
          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-label text-muted-foreground">
              Slides
              <select
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="rounded-sm border bg-panel px-1 py-0.5 text-label text-foreground"
              >
                {SLIDE_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n === 'auto' ? 'Auto' : n}
                  </option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-label text-faint">Ctrl + Enter</span>
            <Button
              onClick={generate}
              disabled={!prompt.trim()}
              className="rounded-full bg-ai px-4 text-white hover:bg-ai/90"
            >
              Generate <ArrowUp strokeWidth={2} />
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
                'rounded-full border bg-panel/80 px-3 py-1.5 text-ui transition-colors duration-120',
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
              if (!res.ok) window.alert(res.message);
            }}
          />
        </div>
      </div>
      <RecentProjects />
    </main>
  );
}
