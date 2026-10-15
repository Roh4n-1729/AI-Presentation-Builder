import { createDeck } from '../lib/factories.js';
import { createSampleDeck } from '../lib/sampleDeck.js';
import { DeckSchema } from '../lib/schema/index.js';
import {
  deleteProject as removeProject,
  getCurrentProjectId,
  listProjects,
  loadProject,
  saveProject,
  setCurrentProjectId,
  startAutosave,
} from './persistence.js';

/*
 * Workspace lifecycle (D39, D40): which screen shows, which project is open, and the ways to start
 * one. Up to 5 projects live in IndexedDB; the StartScreen lists them.
 *   load with an open project  -> editor, deck + chat restored
 *   otherwise                  -> StartScreen (prompt + recent presentations)
 */

const newDeckId = () => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const emptyDeck = () => createDeck({ id: newDeckId(), title: 'Untitled presentation' });

let booted = null; // StrictMode runs effects twice in dev: boot once
let autosave = null;

/** Refresh the StartScreen's list of saved presentations. */
export async function refreshProjects(store) {
  store.getState().setRecentProjects(await listProjects());
}

/** @param {ReturnType<import('../store/index.js').createAppStore>} store */
export function bootWorkspace(store) {
  booted ??= (async () => {
    await refreshProjects(store);
    const id = await getCurrentProjectId();
    const saved = id ? await loadProject(id) : null;
    const s = store.getState();
    if (saved) {
      s.replaceDeck(saved.deck);
      s.replaceMessages(saved.messages);
      s.setSaveStatus('saved');
      s.setScreen('editor');
    } else {
      s.setScreen('start');
    }
    autosave = startAutosave(store, {
      // Saving also marks the project as the open one, so a reload returns to it.
      save: async (snapshot) => {
        await saveProject(snapshot);
        const now = store.getState();
        if (now.screen === 'editor' && now.deck.id === snapshot.deck.id)
          await setCurrentProjectId(snapshot.deck.id);
      },
    });
  })();
  return booted;
}

/** Finish saving the open project before switching away from it. */
const settle = () => autosave?.flush();

/** Show a project in the editor (fresh or loaded). */
function show(store, deck, messages = []) {
  const s = store.getState();
  s.replaceDeck(deck);
  s.replaceMessages(messages);
  s.setSaveStatus('idle');
  s.setScreen('editor');
}

/** "New presentation" / home: back to the StartScreen. The open project stays saved. */
export async function goToStart(store) {
  const s = store.getState();
  if (s.aiBusy) return;
  await settle();
  s.replaceDeck(emptyDeck());
  s.clearChat();
  s.setScreen('start');
  await setCurrentProjectId(null);
  await refreshProjects(store);
}

export async function openProject(store, id) {
  await settle();
  const saved = await loadProject(id);
  if (!saved) {
    await refreshProjects(store); // vanished or unreadable: drop it from the list view
    return false;
  }
  show(store, saved.deck, saved.messages);
  store.getState().setSaveStatus('saved');
  await setCurrentProjectId(id);
  return true;
}

export async function deleteProject(store, id) {
  await removeProject(id);
  await refreshProjects(store);
}

export async function startBlank(store) {
  await settle();
  show(store, emptyDeck());
}

export async function startFromSample(store) {
  await settle();
  const deck = { ...createSampleDeck(), id: newDeckId() }; // each copy is its own project
  show(store, deck);
  await saveProject({ deck, messages: [] });
  await setCurrentProjectId(deck.id);
  store.getState().setSaveStatus('saved');
}

/** Generation from the StartScreen: open the editor; the AI run creates the deck there. */
export async function prepareForGeneration(store) {
  await settle();
  show(store, emptyDeck());
}

/**
 * Open a deck file (.json from "Export → Deck file") as a new project. The file is validated
 * like a stored deck; it gets a fresh id so importing the same file twice gives two projects.
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function importDeckFile(store, file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }
  const raw = parsed?.format === 'ai-presentation-builder' ? parsed.deck : parsed;
  const check = DeckSchema.safeParse(raw);
  if (!check.success) {
    const issue = check.error.issues[0];
    return {
      ok: false,
      message: `That file isn't a deck from this app (${issue?.path?.join('.') || 'deck'}: ${issue?.message}).`,
    };
  }
  await settle();
  const deck = { ...check.data, id: newDeckId() };
  show(store, deck);
  await saveProject({ deck, messages: [] });
  await setCurrentProjectId(deck.id);
  store.getState().setSaveStatus('saved');
  return { ok: true };
}
