import { createStore } from 'zustand/vanilla';
import { createSampleDeck } from '../lib/sampleDeck.js';
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
  }));
}

/** The app's single store. Persistence (IndexedDB) replaces the sample deck in a later step. */
export const appStore = createAppStore(createSampleDeck());
