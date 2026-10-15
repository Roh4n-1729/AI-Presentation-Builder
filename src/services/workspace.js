import { createDeck } from '../lib/factories.js';
import { createSampleDeck } from '../lib/sampleDeck.js';
import { clearWorkspace, loadWorkspace, startAutosave } from './persistence.js';

/*
 * Workspace lifecycle: which screen shows on load, and the ways to start a presentation.
 *   first visit (or nothing saved)  -> StartScreen
 *   returning user                  -> straight into the editor with deck + chat restored
 */

export const emptyDeck = () =>
  createDeck({ id: `d_${Date.now().toString(36)}`, title: 'Untitled presentation' });

let booted = null; // StrictMode runs effects twice in dev: boot once

/** @param {ReturnType<import('../store/index.js').createAppStore>} store */
export function bootWorkspace(store) {
  booted ??= (async () => {
    const saved = await loadWorkspace();
    const s = store.getState();
    if (saved) {
      s.replaceDeck(saved.deck);
      s.replaceMessages(saved.messages);
      s.setSaveStatus('saved');
      s.setScreen('editor');
    } else {
      s.setScreen('start');
    }
    startAutosave(store); // after restoring, so the restore itself isn't saved back
  })();
  return booted;
}

/** "+ New": clear the deck and chat and go back to the StartScreen. */
export async function newPresentation(store) {
  const s = store.getState();
  if (s.aiBusy) return;
  s.replaceDeck(emptyDeck());
  s.clearChat();
  s.setScreen('start');
  await clearWorkspace().catch(() => {});
}

export function startBlank(store) {
  const s = store.getState();
  s.replaceDeck(emptyDeck());
  s.clearChat();
  s.setScreen('editor');
}

export function startFromSample(store) {
  const s = store.getState();
  s.replaceDeck(createSampleDeck());
  s.clearChat();
  s.setScreen('editor');
}
