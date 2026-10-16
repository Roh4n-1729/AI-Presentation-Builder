import { useEffect, useLayoutEffect, useRef } from 'react';
import { Navigate, Outlet, useMatch, useParams } from 'react-router';
import { PresentMode } from '@/features/present/PresentMode.jsx';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { useCloseProjectOnMount, useProjectRoute } from '@/hooks/useWorkspace.js';
import { deckPath, HOME_PATH, slideIndexFrom, titleFor } from '@/lib/routes.js';
import { EditorScreen } from './EditorScreen.jsx';
import { StartScreen } from './StartScreen.jsx';

/*
 * Route components (D59). The URL decides what is on screen; these load or close the project it
 * names and render the screen. Present mode is a child route of the deck, drawn over the editor.
 */

const Busy = () => <div className="h-full bg-background" aria-busy="true" />;

/** `/`: the StartScreen. Leaving a project for it closes the project (it stays saved). */
export function StartRoute() {
  useCloseProjectOnMount();
  const ready = useDeck((s) => s.screen === 'start');
  useEffect(() => {
    document.title = titleFor('');
  }, []);
  return ready ? <StartScreen /> : <Busy />;
}

/**
 * Leaving Present by any path (Esc, the X, the last slide, Back) ends fullscreen (D67). Watched
 * from DeckRoute, which stays mounted, as a change of the URL from a Present URL to one that
 * isn't, so React's StrictMode double effects can't end a presentation that just began.
 */
function useExitFullscreenWhenPresentEnds() {
  const presentingUrl = Boolean(useMatch('/deck/:deckId/present/:slide'));
  const was = useRef(presentingUrl);
  useEffect(() => {
    if (was.current && !presentingUrl && document.fullscreenElement)
      document.exitFullscreen?.().catch(() => {});
    was.current = presentingUrl;
  }, [presentingUrl]);
}

/** `/deck/:deckId`: the editor for that project; an unknown or evicted project goes home. */
export function DeckRoute() {
  const { deckId } = useParams();
  const status = useProjectRoute(deckId);
  useExitFullscreenWhenPresentEnds();
  const title = useDeck((s) => s.deck.title);
  useEffect(() => {
    if (status === 'ready') document.title = titleFor(title);
  }, [status, title]);
  if (status === 'missing') return <Navigate to={HOME_PATH} replace />;
  if (status !== 'ready') return <Busy />;
  return (
    <>
      <EditorScreen />
      <Outlet />
    </>
  );
}

/**
 * `/deck/:deckId/present/:slide`: Present mode on that slide. The store mirrors the route
 * (`presenting`) for code that isn't a component (keyboard and clipboard handlers, the canvas
 * hiding its handles); the URL stays the source of truth.
 */
export function PresentRoute() {
  const { deckId, slide } = useParams();
  const count = useDeck((s) => s.deck.slideOrder.length);
  const index = slideIndexFrom(slide, count);
  useLayoutEffect(() => {
    if (index === null) return undefined;
    getDeckState().setPresenting({ index });
    // Only the store mirror is cleared here. Fullscreen is left by DeckRoute when the URL stops
    // being a Present URL (D67): StrictMode runs this cleanup once right after mounting, and
    // exiting fullscreen here ended the presentation as soon as it started.
    return () => getDeckState().setPresenting(null);
  }, [index]);
  if (index === null) return <Navigate to={deckPath(deckId)} replace />;
  return <PresentMode index={index} />;
}
