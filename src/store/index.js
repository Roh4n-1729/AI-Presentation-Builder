import { createStore } from 'zustand/vanilla';
import { createDeck } from '../lib/factories.js';
import { createChatSlice } from './chatSlice.js';
import { createDeckSlice } from './deckSlice.js';
import { createUiSlice } from './uiSlice.js';

/**
 * One store, vanilla (D26): services and tests use it without React; components read it through
 * the selector hooks in src/hooks/useDeck.js.
 *
 * @param {import('../lib/schema/deck.js').Deck} initialDeck
 */
export function createAppStore(initialDeck) {
  return createStore((set, get, api) => ({
    ...createDeckSlice(initialDeck)(set, get, api),
    ...createUiSlice(initialDeck)(set, get, api),
    ...createChatSlice()(set, get, api),
  }));
}

/**
 * The app's single store. It starts empty; on load, the workspace service restores the saved
 * deck and chat from IndexedDB or shows the StartScreen (src/services/workspace.js).
 */
export const appStore = createAppStore(
  createDeck({ id: 'd_boot', title: 'Untitled presentation' }),
);
