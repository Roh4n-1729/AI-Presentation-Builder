import { createBrowserRouter, Navigate } from 'react-router';
import { DeckRoute, PresentRoute, StartRoute } from './screens/routes.jsx';

/** The app's routes (D59). Vercel rewrites every non-/api path to index.html (vercel.json). */
export const router = createBrowserRouter([
  { path: '/', element: <StartRoute /> },
  {
    path: '/deck/:deckId',
    element: <DeckRoute />,
    children: [{ path: 'present/:slide', element: <PresentRoute /> }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
