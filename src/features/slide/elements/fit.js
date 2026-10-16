import { useLayoutEffect, useState } from 'react';

/**
 * Largest font size (from `base` down to `min`, in 4% steps) at which the text fits its box.
 * Measures the real DOM node, so wrapping, fonts and bullets are exact. Module-level so the
 * inline-style writes stay outside the component (React Compiler rule).
 */
export function fitFontSize(node, base, min) {
  const prev = node.style.fontSize;
  let size = base;
  node.style.fontSize = `${size}px`;
  while (node.scrollHeight > node.clientHeight + 1 && size > min) {
    size = Math.max(min, Math.floor(size * 0.96));
    node.style.fontSize = `${size}px`;
  }
  node.style.fontSize = prev;
  return size;
}

const fontsReady = typeof document !== 'undefined' && document.fonts ? document.fonts.ready : null;

/**
 * Auto-shrink (D41): text that doesn't fit its box is drawn smaller, never below the theme's
 * minimum, instead of being clipped. Render-time only: the stored font size is unchanged, so
 * growing the box (or shortening the text) brings it back to full size.
 */
export function useFittedSize(ref, base, min, deps) {
  const [size, setSize] = useState(base);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let alive = true;
    const measure = () => alive && setSize(fitFontSize(node, base, min));
    measure();
    fontsReady?.then(measure); // re-measure once web fonts have loaded (metrics change)
    return () => {
      alive = false;
    };
  }, [ref, base, min, ...deps]); // deps spread from the caller
  return size;
}
