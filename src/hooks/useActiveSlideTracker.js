import { useEffect } from 'react';
import { getDeckState } from './useDeck.js';

/** The most visible slide in the column becomes the "active" slide (filmstrip highlight, AI context). */
export function useActiveSlideTracker(paneRef, slideOrder) {
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return undefined;
    const ratios = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => ratios.set(e.target.dataset.slideFrame, e.intersectionRatio));
        const best = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0) getDeckState().setActiveSlide(best[0]);
      },
      { root: pane, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pane.querySelectorAll('[data-slide-frame]').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [paneRef, slideOrder]);
}
