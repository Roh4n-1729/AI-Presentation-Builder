/**
 * URL paths (D59). React Router owns navigation; these build the paths so no code writes them by
 * hand. Slide numbers in URLs are 1-based, as people count them.
 *
 *   /                       StartScreen
 *   /deck/:deckId           editor with that project
 *   /deck/:deckId/present/:slide   Present mode on that slide
 */
export const HOME_PATH = '/';
export const deckPath = (deckId) => `/deck/${encodeURIComponent(deckId)}`;
export const presentPath = (deckId, slideNumber) =>
  `${deckPath(deckId)}/present/${Math.max(1, Math.floor(slideNumber) || 1)}`;

/** The 0-based slide index a `:slide` param asks for, clamped to the deck (null if no slides). */
export function slideIndexFrom(param, slideCount) {
  if (slideCount < 1) return null;
  const n = Number.parseInt(param ?? '1', 10);
  return Math.min(slideCount, Math.max(1, Number.isFinite(n) ? n : 1)) - 1;
}

export const APP_NAME = 'AI Presentation Builder';
export const titleFor = (deckTitle) => (deckTitle ? `${deckTitle} · ${APP_NAME}` : APP_NAME);
