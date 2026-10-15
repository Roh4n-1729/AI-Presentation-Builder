import { useStore } from 'zustand';
import * as actions from '@/store/actions.js';
import { appStore } from '@/store/index.js';

/** Read the store in a component: `useDeck((s) => s.deck.slides[id])` re-renders on change only. */
export const useDeck = (selector) => useStore(appStore, selector);

/** Read the latest state inside an event handler (no re-render subscription). */
export const getDeckState = () => appStore.getState();

/** Composite actions bound to the app store (stable object, safe in deps arrays). */
const BOUND = Object.fromEntries(
  Object.entries(actions).map(([name, fn]) => [name, (...args) => fn(appStore, ...args)]),
);
export const useDeckActions = () => BOUND;
