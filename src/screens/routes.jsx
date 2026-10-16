import { useEffect, useLayoutEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';
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

/** `/deck/:deckId`: the editor for that project; an unknown or evicted project goes home. */
export function DeckRoute() {
  const { deckId } = useParams();
  const status = useProjectRoute(deckId);
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
    if (index !== null) getDeckState().setPresenting({ index });
  }, [index]);
  useLayoutEffect(
    () => () => {
      // Leaving the route by any path (Esc, the X, Back): no Present state or fullscreen left behind.
      getDeckState().setPresenting(null);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    },
    [],
  );
  if (index === null) return <Navigate to={deckPath(deckId)} replace />;
  return <PresentMode index={index} />;
}
