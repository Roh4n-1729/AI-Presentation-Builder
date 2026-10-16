import { Palette } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { getTheme, PICKABLE_THEMES } from '@/lib/theme/index.js';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

/**
 * A tiny slide in the theme's colors: background, a title in the heading font, a body line and
 * two chart bars. Shows the variant the canvas will display (the dark one in dark mode).
 */
function ThemePreview({ theme }) {
  const c = theme.colors;
  return (
    <span
      aria-hidden
      className="relative flex h-7 w-12 shrink-0 flex-col justify-center gap-[3px] overflow-hidden rounded-[3px] px-1.5 ring-1 ring-border"
      style={{ background: c.bg }}
    >
      <span
        className="text-[9px] leading-none"
        style={{ color: c.text, fontFamily: theme.fonts.heading }}
      >
        Aa
      </span>
      <span className="h-[2px] w-6 rounded-full" style={{ background: c.muted }} />
      <span className="absolute right-1.5 bottom-1 flex items-end gap-[2px]">
        <span className="h-2.5 w-1 rounded-[1px]" style={{ background: theme.chart[0] }} />
        <span className="h-1.5 w-1 rounded-[1px]" style={{ background: theme.chart[1] }} />
      </span>
    </span>
  );
}

/** Slide theme for the deck (one undoable op). Colors and fonts restyle; positions don't move. */
export function ThemeMenu() {
  // Normalized: a saved deck may carry a retired id (sand → sage).
  const current = useDeck((s) => getTheme(s.deck.theme).id);
  const scheme = useDeck((s) => s.colorScheme);
  const aiBusy = useDeck((s) => s.aiBusy);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={aiBusy} aria-label="Slide theme">
          <Palette strokeWidth={1.75} /> Theme
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-label text-muted-foreground">
          Slide theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(theme) =>
            getDeckState().dispatch(
              { type: 'update_deck', patch: { theme } },
              { label: 'Change theme' },
            )
          }
        >
          {PICKABLE_THEMES().map((t) => (
            <DropdownMenuRadioItem key={t.id} value={t.id}>
              <ThemePreview theme={getTheme(t.id, scheme)} />
              <span className="flex flex-col">
                {t.name}
                <span className="text-label text-muted-foreground">{t.blurb}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
