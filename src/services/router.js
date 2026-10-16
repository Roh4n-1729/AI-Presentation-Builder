/**
 * URL routing (D49). Three routes, all derived from the store, which stays the source of truth:
 *
 *   /                       StartScreen
 *   /deck/:id               editor with that project
 *   /deck/:id/present/:n    Present mode on slide n (1-based)
 *
 * Store → URL: a store subscription writes the route (push for a new screen, project or entering
 * Present; replace for stepping between slides while presenting). URL → store: Back/Forward and
 * links opened in a new tab run the same workspace actions the buttons use. A route that can't be
 * shown (a project that was never saved or was evicted) falls back to "/" with replaceState, so
 * Back never lands on a dead page.
 */

const APP_NAME = 'AI Presentation Builder';

/** @returns {{ name: 'start' } | { name: 'editor', id: string, present: number | null }} */
export function parseRoute(pathname) {
  const m = /^\/deck\/([\w-]+)(?:\/present(?:\/(\d+))?)?\/?$/.exec(pathname);
  if (!m) return { name: 'start' };
  const present = pathname.includes('/present') ? Math.max(1, Number(m[2] ?? 1)) : null;
  return { name: 'editor', id: m[1], present };
}

/** The route the current state should be at, or null while booting. */
export function routeFor(state) {
  if (state.screen === 'start') return '/';
  if (state.screen !== 'editor') return null;
  const base = `/deck/${state.deck.id}`;
  return state.presenting ? `${base}/present/${state.presenting.index + 1}` : base;
}

function titleFor(state) {
  return state.screen === 'editor' && state.deck.title
    ? `${state.deck.title} · ${APP_NAME}`
    : APP_NAME;
}

/**
 * Apply a route to the store (initial load, Back/Forward).
 * @param {{ openProject: (id: string) => Promise<boolean>, goToStart: () => Promise<void>,
 *   isOpen: (id: string) => boolean }} ws
 */
export async function applyRoute(store, route, ws) {
  const s = store.getState();
  if (route.name === 'start') {
    if (s.presenting) s.setPresenting(null);
    if (s.screen !== 'start') await ws.goToStart();
    return;
  }
  if (!ws.isOpen(route.id)) {
    const ok = await ws.openProject(route.id);
    if (!ok) {
      await ws.goToStart();
      return;
    }
  }
  const now = store.getState();
  const want = route.present === null ? null : route.present - 1;
  const max = now.deck.slideOrder.length - 1;
  if (want === null && now.presenting) now.setPresenting(null);
  if (want !== null && max >= 0) now.setPresenting({ index: Math.min(want, max) });
}

/**
 * Keep the URL and the store in step. Call once after boot.
 * @returns {() => void} stop
 */
export function startRouter(store, ws) {
  let applying = false;
  let last = routeFor(store.getState());

  const write = (state, { replace = false } = {}) => {
    const path = routeFor(state);
    document.title = titleFor(state);
    if (!path || path === location.pathname) return;
    const wasPresent = Boolean(history.state?.present);
    const isPresent = Boolean(state.presenting);
    if (wasPresent && !isPresent && !replace) {
      // Leaving Present (Esc, the X, fullscreen exit): step back to the editor entry we pushed
      // when it started, instead of stacking a second editor entry on top.
      history.back();
      return;
    }
    const sameDeckPresent = wasPresent && isPresent;
    const mode = replace || sameDeckPresent ? 'replaceState' : 'pushState';
    history[mode]({ present: isPresent }, '', path);
  };

  const unsubscribe = store.subscribe((state, prev) => {
    if (applying) return;
    const path = routeFor(state);
    if (path !== last || state.deck.title !== prev.deck.title) {
      last = path;
      write(state);
    }
  });

  const onPop = async () => {
    applying = true;
    try {
      await applyRoute(store, parseRoute(location.pathname), ws);
    } finally {
      applying = false;
      const state = store.getState();
      last = routeFor(state);
      if (!state.presenting && document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {});
      write(state, { replace: true }); // the route couldn't be shown as-is: correct the URL
    }
  };
  window.addEventListener('popstate', onPop);

  write(store.getState(), { replace: true });
  return () => {
    unsubscribe();
    window.removeEventListener('popstate', onPop);
  };
}
