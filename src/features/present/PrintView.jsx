import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { getTheme } from '@/lib/theme/index.js';
import { SlideRenderer } from '@/features/slide/SlideRenderer.jsx';
import './present.css';

// One slide per page at 13.333 x 7.5 in = 1280 x 720 CSS px, so the artboard scales by 2/3.
const PAGE_W = 1280;
const SCALE = PAGE_W / ARTBOARD_W;

/**
 * Print / Save as PDF (D44): every slide drawn by the same renderer, one per landscape page, in
 * the deck's own theme. Mounted only while printing; opens the print dialog once fonts and charts
 * have rendered and unmounts when the dialog closes. Vector output: text stays selectable and
 * charts stay sharp in the PDF.
 */
export function PrintView() {
  const deck = useDeck((s) => s.deck);
  const theme = getTheme(deck.theme);

  useEffect(() => {
    let cancelled = false;
    const done = () => getDeckState().setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    (async () => {
      await document.fonts?.ready;
      // two frames: React commit, then layout (auto-shrink measures) before the dialog snapshots
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!cancelled) window.print();
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', done);
    };
  }, []);

  return createPortal(
    <div className="print-root" aria-hidden>
      {deck.slideOrder.map((sid) => (
        <section
          key={sid}
          className="print-page"
          style={{ width: PAGE_W, height: (ARTBOARD_H * PAGE_W) / ARTBOARD_W }}
        >
          {/* CSS zoom, not transform: Chromium's PDF output drops or double-scales SVG charts
              inside a scaled transform; zoom lays the slide out at page size. */}
          <div className="print-scaler" style={{ zoom: SCALE }}>
            <SlideRenderer slide={deck.slides[sid]} theme={theme} />
          </div>
        </section>
      ))}
    </div>,
    document.body,
  );
}
