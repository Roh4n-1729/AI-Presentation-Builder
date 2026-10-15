import * as ai from '@/services/ai.js';
import { appStore } from '@/store/index.js';

/** AI actions bound to the app store (features reach services only through hooks, D19). */
const BOUND = {
  runEdit: (text) => ai.runEdit(appStore, text),
  generateDeck: (opts) => ai.generateDeck(appStore, opts),
  continueGeneration: (msgId) => ai.continueGeneration(appStore, msgId),
  stop: () => ai.stopAi(),
};
export const useAi = () => BOUND;
