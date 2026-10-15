import { Palette } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { PICKABLE_THEMES } from '@/lib/theme/index.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

/** Slide theme for the deck (one undoable op). Colors and fonts restyle; positions don't move. */
export function ThemeMenu() {
  const current = useDeck((s) => s.deck.theme);
  const aiBusy = useDeck((s) => s.aiBusy);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span>
          <IconButtonTip icon={Palette} label="Slide theme" disabled={aiBusy} />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
              <span className="flex gap-0.5" aria-hidden>
                {[t.colors.bg, t.colors.text, t.chart[0], t.chart[1]].map((c, i) => (
                  <span
                    key={i}
                    className="size-3 rounded-full ring-1 ring-border"
                    style={{ background: c }}
                  />
                ))}
              </span>
              {t.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
