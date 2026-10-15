import { cn } from '@/primitives/cn.js';

/**
 * Drop-target indicator drawn ON TOP of a slide (frame or thumbnail): a ring outside the edge that
 * follows the corner radius, a light tint, and a label. It's an overlay, so slide content can't
 * clip it, and pointer-events are off so it never affects hit-testing.
 *
 * @param {{ label: string, className?: string, compact?: boolean }} props
 */
export function DropRing({ label, className, compact = false }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute -inset-[5px] z-20 rounded-[13px] bg-user/8 ring-[3px] ring-user',
        'animate-in duration-120 fade-in-0',
        className,
      )}
    >
      <span
        className={cn(
          'absolute left-1/2 -translate-x-1/2 rounded-full bg-user font-medium whitespace-nowrap text-white shadow-float',
          compact ? 'top-1.5 px-2 py-0.5 text-[11px]' : 'top-3 px-3 py-1 text-label',
        )}
      >
        {label}
      </span>
    </div>
  );
}
