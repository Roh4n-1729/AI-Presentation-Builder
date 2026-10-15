import { DEFAULT_THEME_ID } from './theme/themes.js';

/**
 * Plain constructors for new decks and slides. Ids are passed in (minted by the caller with
 * lib/ids.js), keeping these deterministic like applyOp.
 */

/** @returns {import('./schema/deck.js').Deck} */
export function createDeck({ id, title = 'Untitled presentation', theme = DEFAULT_THEME_ID }) {
  return { id, title, aspectRatio: '16:9', theme, slideOrder: [], slides: {} };
}

/** @returns {import('./schema/deck.js').Slide} */
export function createSlide({ id, title = 'Untitled slide', layout = 'blank', notes = '' }) {
  return { id, title, layout, background: { color: 'bg' }, notes, elementOrder: [], elements: {} };
}
