import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { deckPath, presentPath } from '@/lib/routes.js';
import { appStore } from '@/store/index.js';

/**
 * Present mode is a route, /deck/:id/present/:slide (D59). Entering pushes it (so Back leaves
 * Present); stepping between slides replaces it (so Back doesn't walk through every slide);
 * leaving goes back to the editor entry it came from, or replaces the URL when Present was
 * opened directly (a shared link or a reload).
 */
export function usePresentNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromEditor = Boolean(location.state?.fromEditor);
  return useMemo(() => {
    const deckId = () => appStore.getState().deck.id;
    const count = () => appStore.getState().deck.slideOrder.length;
    return {
      /** Start presenting at slide `index` (0-based). Call inside the click / key handler. */
      enter(index) {
        if (!count()) return;
        navigate(presentPath(deckId(), index + 1), { state: { fromEditor: true } });
        // Fullscreen must start inside the user gesture.
        document.documentElement.requestFullscreen?.().catch(() => {});
      },
      /** Show slide `index` (clamped to the deck). */
      go(index) {
        const i = Math.max(0, Math.min(count() - 1, index));
        navigate(presentPath(deckId(), i + 1), { replace: true, state: location.state });
      },
      exit() {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        if (fromEditor) navigate(-1);
        else navigate(deckPath(deckId()), { replace: true });
      },
    };
  }, [navigate, location.state, fromEditor]);
}
