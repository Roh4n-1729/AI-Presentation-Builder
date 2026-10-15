import { useLayoutEffect, useState } from 'react';
import { ARTBOARD_W } from '@/lib/constants.js';

/** Fit-width scale for the slide column: pane width -> 1920 artboard units (capped). */
export function useFitScale(ref, { padding = 64, max = 1180 } = {}) {
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.min(entry.contentRect.width - padding * 2, max);
      setScale(Math.max(w, 240) / ARTBOARD_W);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref, padding, max]);
  return scale;
}
