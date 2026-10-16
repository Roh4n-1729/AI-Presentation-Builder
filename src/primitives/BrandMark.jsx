import { useId } from 'react';
import { cn } from './cn.js';

/**
 * The app's mark (D50): two stacked slides. The back one is an outline in the text color; the
 * front one carries the StartScreen's saffron → periwinkle wash (the AI's color into the user's),
 * so the editor and the landing page read as one product.
 */
export function BrandMark({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-6', className)}>
      <defs>
        <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ai)" />
          <stop offset="1" stopColor="var(--user)" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="4.5"
        width="15"
        height="10.5"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <rect x="7" y="9" width="15" height="10.5" rx="2.5" fill={`url(#${id}-wash)`} />
    </svg>
  );
}
