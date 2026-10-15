import { useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  FileDown,
  FileJson,
  Image as ImageIcon,
  Presentation,
  Redo2,
  Shapes,
  Sparkles,
  Table2,
  Type,
  Undo2,
} from 'lucide-react';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ToolbarGroup } from '@/primitives/ToolbarGroup.jsx';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';
import { Kbd } from '@/primitives/ui/kbd.jsx';
import { getTheme, resolveColor } from '@/lib/theme/index.js';

/**
 * Throwaway design-system check (§8c): tokens in light/dark, type, buttons, toolbar with tooltips,
 * a dropdown menu and the default slide theme. Deleted when the editor replaces App.
 */
const CHROME_TOKENS = [
  ['background', 'bg-background'],
  ['panel', 'bg-panel'],
  ['subtle', 'bg-subtle'],
  ['canvas', 'bg-canvas'],
  ['foreground', 'bg-foreground'],
  ['muted-fg', 'bg-muted-foreground'],
  ['faint', 'bg-faint'],
  ['border', 'bg-border'],
  ['user', 'bg-user'],
  ['ai', 'bg-ai'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['destructive', 'bg-destructive'],
];

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-label font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SlideThemePreview() {
  const theme = getTheme('paper');
  const S = 0.3; // artboard units -> preview px
  return (
    <div className="flex flex-wrap items-start gap-6">
      {/* Inline styles only, like the real SlideRenderer: canvas, print and PPTX read the same values. */}
      <div
        className="overflow-hidden rounded-md border shadow-float"
        style={{ width: 1920 * S, height: 1080 * S, background: theme.colors.bg }}
      >
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${S})`,
            transformOrigin: 'top left',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 96,
              top: 72,
              width: 1728,
              fontFamily: theme.fonts.heading,
              fontSize: theme.type.title,
              lineHeight: theme.lineHeight.heading,
              color: resolveColor('text', theme),
              letterSpacing: '-0.01em',
            }}
          >
            Revenue is growing
          </div>
          <div
            style={{
              position: 'absolute',
              left: 96,
              top: 250,
              width: 980,
              fontFamily: theme.fonts.body,
              fontSize: theme.type.body,
              lineHeight: theme.lineHeight.body,
              color: resolveColor('text', theme),
            }}
          >
            {[
              '+31% year over year in Q3',
              'Enterprise share up to 42%',
              'Churn below 2% monthly',
            ].map((t) => (
              <div key={t} style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
                <span style={{ color: resolveColor('accent', theme) }}>•</span>
                {t}
              </div>
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 1180,
              top: 260,
              width: 640,
              height: 640,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 28,
              borderBottom: `3px solid ${resolveColor('border', theme)}`,
            }}
          >
            {[38, 52, 61, 80].map((h, i) => (
              <div
                key={h}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: theme.chart[i % 2],
                  borderRadius: '8px 8px 0 0',
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-ui text-muted-foreground">Chart palette (fixed order)</p>
        <div className="flex gap-1.5">
          {theme.chart.map((c) => (
            <div key={c} className="size-8 rounded-sm" style={{ background: c }} title={c} />
          ))}
        </div>
        <p className="max-w-64 text-label text-faint">
          Preview bars are plain divs; real charts are Recharts (canvas port).
        </p>
      </div>
    </div>
  );
}

export default function DesignCheck() {
  const [tool, setTool] = useState('chart');
  const [glowKey, setGlowKey] = useState(0);

  const tools = [
    ['text', Type, 'Text', 'T'],
    ['image', ImageIcon, 'Image', 'I'],
    ['chart', BarChart3, 'Chart', 'C'],
    ['table', Table2, 'Table', 'B'],
    ['shape', Shapes, 'Shape', 'S'],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <header className="space-y-2">
        <h1 className="font-display text-display">Make a deck worth presenting.</h1>
        <p className="text-sm text-muted-foreground">
          Instrument Serif for display · Geist for UI ·{' '}
          <span className="font-mono">Geist Mono</span> for data
        </p>
      </header>

      <Section title="Type scale">
        <div className="space-y-1">
          <p className="text-label">12 · label</p>
          <p className="text-ui">13 · UI body</p>
          <p className="text-sm">14 · emphasis</p>
          <p className="text-base">16 · section</p>
          <p className="text-xl">20 · panel title</p>
          <p className="text-[28px] leading-tight">28 · empty states</p>
          <p className="font-mono text-ui tabular-nums">1,240.50 · 98.2 · el_c7x2</p>
        </div>
      </Section>

      <Section title="Chrome tokens">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {CHROME_TOKENS.map(([name, cls]) => (
            <div key={name} className="space-y-1">
              <div className={`h-10 rounded-md border ${cls}`} />
              <p className="text-label text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Generate deck</Button>
          <Button variant="secondary">Start blank</Button>
          <Button variant="outline">Load sample deck</Button>
          <Button variant="ai">
            <Sparkles strokeWidth={1.5} /> Ask AI
          </Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete slide</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary">
            Small
          </Button>
        </div>
      </Section>

      <Section title="Toolbar · tooltips · menu">
        <div className="inline-flex items-center rounded-lg border bg-panel p-1 shadow-float">
          <ToolbarGroup>
            <IconButtonTip icon={Undo2} label="Undo" shortcut="Ctrl Z" />
            <IconButtonTip icon={Redo2} label="Redo" shortcut="Ctrl Y" />
          </ToolbarGroup>
          <ToolbarGroup>
            {tools.map(([id, Icon, label, key]) => (
              <IconButtonTip
                key={id}
                icon={Icon}
                label={`Insert ${label.toLowerCase()}`}
                shortcut={key}
                active={tool === id}
                onClick={() => setTool(id)}
              />
            ))}
          </ToolbarGroup>
          <ToolbarGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Export <ChevronDown strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Export as</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Presentation strokeWidth={1.5} /> PowerPoint (.pptx)
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileDown strokeWidth={1.5} /> PDF (print view)
                  <DropdownMenuShortcut>Ctrl P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <FileJson strokeWidth={1.5} /> Deck file (.json)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ToolbarGroup>
        </div>
        <p className="text-ui text-muted-foreground">
          Hover for tooltips; the active tool is tinted indigo (the user&apos;s color). Shortcuts
          render as <Kbd>Ctrl</Kbd> <Kbd>Z</Kbd>.
        </p>
      </Section>

      <Section title="AI accent · motion">
        <div className="flex items-center gap-4">
          <div
            key={glowKey}
            className="flex h-16 w-56 animate-ai-glow items-center justify-center rounded-md border bg-panel text-ui"
          >
            Element the AI just changed
          </div>
          <Button variant="secondary" size="sm" onClick={() => setGlowKey((k) => k + 1)}>
            Replay glow
          </Button>
          <span className="rounded-full bg-ai-soft px-2.5 py-1 text-label font-medium text-ai">
            update_element · slide 3
          </span>
        </div>
      </Section>

      <Section title="Default slide theme (Paper)">
        <SlideThemePreview />
      </Section>
    </div>
  );
}
