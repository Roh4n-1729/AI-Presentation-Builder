import { cn } from '@/primitives/cn.js';

/**
 * Animated home for a collapsible editor panel (D48). The panel stays mounted (the AI chat keeps
 * its draft and scroll); the slot's width animates between 0 and the panel's width with the
 * `base` motion token, and the inner box keeps its full width so content slides out of view
 * instead of reflowing. A closed panel is `inert`: hidden from tab order and screen readers.
 */
export function PanelSlot({ open, width, side, children }) {
  return (
    <div
      className="relative h-full shrink-0 overflow-hidden transition-[width] duration-base ease-standard"
      style={{ width: open ? width : 0 }}
      inert={!open}
    >
      <div
        className={cn('absolute inset-y-0 flex', side === 'left' ? 'right-0' : 'left-0')}
        style={{ width }}
      >
        {children}
      </div>
    </div>
  );
}
