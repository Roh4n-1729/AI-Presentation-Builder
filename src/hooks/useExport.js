import { useCallback, useState } from 'react';
import { exportDeckJson, exportPptx } from '@/services/pptxExport.js';
import { appStore } from '@/store/index.js';

/** Export actions for the top bar: PowerPoint, PDF (print view), deck file; present mode. */
export function useExport() {
  const [busy, setBusy] = useState(false);

  const pptx = useCallback(async () => {
    setBusy(true);
    try {
      const { problems } = await exportPptx(appStore.getState().deck);
      if (problems.length)
        window.alert(
          `Exported. ${problems.length} image(s) couldn't be embedded (the site doesn't allow it) and show as placeholders: ${problems.join(', ')}`,
        );
    } catch (err) {
      console.error(err);
      window.alert(`PowerPoint export failed: ${err?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const json = useCallback(() => exportDeckJson(appStore.getState().deck), []);

  /** Mounts the print view; it opens the print dialog itself once everything has rendered. */
  const pdf = useCallback(() => appStore.getState().setPrinting(true), []);

  const present = useCallback((fromStart = false) => {
    const s = appStore.getState();
    if (!s.deck.slideOrder.length) return;
    const index = fromStart ? 0 : Math.max(0, s.deck.slideOrder.indexOf(s.activeSlideId));
    s.setPresenting({ index });
    // Fullscreen must start inside the click handler (a user gesture).
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  return { busy, pptx, json, pdf, present };
}
