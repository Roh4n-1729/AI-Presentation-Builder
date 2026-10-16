import { ChevronDown, Play, SkipBack } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { useExport } from '@/hooks/useExport.js';
import { MenuItem } from '@/primitives/MenuItem.jsx';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

const TRANSITION_LABELS = { none: 'None', fade: 'Fade', push: 'Push' };

/**
 * Present ▾ split button: the main part presents from this slide; the menu starts from the
 * beginning and sets the deck's slide transition (one undoable op, D48).
 */
export function PresentButton() {
  const { present } = useExport();
  const hasSlides = useDeck((s) => s.deck.slideOrder.length > 0);
  const transition = useDeck((s) => s.deck.transition ?? 'fade');
  return (
    <div className="flex items-center rounded-md bg-secondary">
      <Button
        size="sm"
        variant="secondary"
        disabled={!hasSlides}
        onClick={() => present(false)}
        title="Present from this slide (Shift+F5; F5 from the start)"
        className="rounded-r-none"
      >
        <Play strokeWidth={1.75} /> Present
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            disabled={!hasSlides}
            aria-label="Present options"
            className="rounded-l-none border-l border-background/60 px-1.5"
          >
            <ChevronDown strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <MenuItem
            icon={SkipBack}
            label="From the beginning"
            shortcut="F5"
            onSelect={() => present(true)}
          />
          <MenuItem
            icon={Play}
            label="From this slide"
            shortcut="Shift F5"
            onSelect={() => present(false)}
          />
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-label text-muted-foreground">
            Slide transition
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={transition}
            onValueChange={(t) =>
              getDeckState().dispatch(
                { type: 'update_deck', patch: { transition: t } },
                { label: 'Slide transition' },
              )
            }
          >
            {Object.entries(TRANSITION_LABELS).map(([id, label]) => (
              <DropdownMenuRadioItem key={id} value={id}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
