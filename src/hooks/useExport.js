import { useCallback, useState } from 'react';
import { exportDeckJson, exportPptx } from '@/services/pptxExport.js';
import { appStore } from '@/store/index.js';
import { usePresentNavigation } from './usePresentNavigation.js';

/** Export actions for the top bar: PowerPoint, PDF (print view), deck file; present mode. */
export function useExport() {
  const [busy, setBusy] = useState(false);

  const pptx = useCallback(async () => {
    setBusy(true);
    try {
      const { problems } = await exportPptx(appStore.getState().deck);
      const s = appStore.getState();
      if (problems.length)
        s.toast({
          kind: 'info',
          title: 'Exported, with placeholders',
          description: `${problems.length} image(s) couldn't be embedded (the site doesn't allow it) and show as placeholders.`,
        });
      else s.toast({ kind: 'success', title: 'PowerPoint file downloaded' });
    } catch (err) {
      console.error(err);
      appStore.getState().toast({
        kind: 'error',
        title: 'PowerPoint export failed',
        description: String(err?.message ?? err),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const json = useCallback(() => exportDeckJson(appStore.getState().deck), []);

  /** Mounts the print view; it opens the print dialog itself once everything has rendered. */
  const pdf = useCallback(() => appStore.getState().setPrinting(true), []);

  const presentNav = usePresentNavigation();
  const present = useCallback(
    (fromStart = false) => {
      const s = appStore.getState();
      if (!s.deck.slideOrder.length) return;
      const index = fromStart ? 0 : Math.max(0, s.deck.slideOrder.indexOf(s.activeSlideId));
      presentNav.enter(index); // a route (D59); fullscreen starts inside this click
    },
    [presentNav],
  );

  return { busy, pptx, json, pdf, present };
}
