import { useRef } from 'react';
import { Check, Pipette } from 'lucide-react';
import { isHexColor, seriesColor } from '@/lib/theme/index.js';
import { cn } from '@/primitives/cn.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

/**
 * A series' color (D72): automatic (the theme palette in order), one of the theme's six palette
 * slots (`chart1`…`chart6`, so it follows a theme change like any role), or a custom hex.
 */
export function SeriesColorMenu({ series, index, theme, onChange }) {
  const customRef = useRef(null);
  const current = seriesColor(series, index, theme);
  const slots = theme.chart.map((_, i) => `chart${i + 1}`);
  const swatch = (color, selected) => (
    <span
      aria-hidden
      className="relative grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-black/10"
      style={{ background: color }}
    >
      {selected && <Check className="size-3 text-white drop-shadow" strokeWidth={2.5} />}
    </span>
  );
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Color of ${series.name}`}
            title="Series color"
            className="grid size-5 shrink-0 place-items-center rounded-full hover:ring-2 hover:ring-ring/40"
          >
            <span
              className="size-3.5 rounded-full ring-1 ring-black/10"
              style={{ background: current }}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-label text-muted-foreground">
            {series.name}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onChange(undefined)}>
            {swatch(theme.chart[index % theme.chart.length], !series.color)}
            Automatic
          </DropdownMenuItem>
          <div
            className="grid grid-cols-6 gap-1 px-2 py-1.5"
            role="group"
            aria-label="Theme colors"
          >
            {slots.map((slot, i) => (
              <DropdownMenuItem
                key={slot}
                aria-label={`Theme color ${i + 1}`}
                onSelect={() => onChange(slot)}
                className={cn('justify-center p-1')}
              >
                {swatch(theme.chart[i], series.color === slot)}
              </DropdownMenuItem>
            ))}
          </div>
          {/* The native color picker opens from a hidden input once the menu has closed. */}
          <DropdownMenuItem onSelect={() => customRef.current?.click()}>
            {isHexColor(series.color) ? (
              swatch(series.color, true)
            ) : (
              <Pipette className="size-4" strokeWidth={1.5} />
            )}
            Custom…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={customRef}
        type="color"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        value={isHexColor(series.color) && series.color.length === 7 ? series.color : current}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  );
}
