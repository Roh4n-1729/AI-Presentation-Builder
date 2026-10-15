import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge must know our custom font-size tokens (text-ui, text-label, text-display);
// otherwise it treats `text-ui` as a color and drops it when merged with `text-foreground`.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['label', 'ui', 'display'] }] } },
});

/** Join class names, letting later Tailwind classes override earlier conflicting ones. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
