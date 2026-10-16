import { createDeck } from '../lib/factories.js';
import { createSampleDeck } from '../lib/sampleDeck.js';
import { DeckSchema } from '../lib/schema/index.js';
import {
  deleteProject as removeProject,
  listProjects,
  loadProject,
  saveProject,
  setCurrentProjectId,
  startAutosave,
} from './persistence.js';
import { stopAi } from './ai.js';
import { startCaptioner } from './captions.js';
import { startPhotoFiller } from './photos.js';

/*
 * Workspace lifecycle (D39, D40): which project is open, and the ways to start one. Up to 5
 * projects live in IndexedDB; the StartScreen lists them. Navigation belongs to React Router
 * (D59): the route components call `openProject` / `closeProject`, and the "start" functions
 * return the new deck's id for the caller to navigate to. Nothing here reads or writes the URL.
 * `ui.screen` says whether a project is loaded ('editor') or not ('start'); it's data, not a route.
 */

const newDeckId = () => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const emptyDeck = () => createDeck({ id: newDeckId(), title: 'Untitled presentation' });

// Opening, closing and starting projects run one at a time: Back then Forward in quick
// succession must not interleave a close with an open (the later one wins, in order).
let queue = Promise.resolve();
const serial = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

let booted = null; // StrictMode runs effects twice in dev: boot once
let autosave = null;

/** Refresh the StartScreen's list of saved presentations. */
export async function refreshProjects(store) {
  store.getState().setRecentProjects(await listProjects());
}

/**
 * Boot once: the saved-projects list, autosave, and the background services. Which project is
 * shown is up to the route (D59).
 * @param {ReturnType<import('../store/index.js').createAppStore>} store
 */
export function bootWorkspace(store) {
  booted ??= (async () => {
    await refreshProjects(store);
    autosave = startAutosave(store, {
      // Saving also marks the project as the open one (kept for older builds' boot path).
      save: async (snapshot) => {
        await saveProject(snapshot);
        const now = store.getState();
        if (now.screen === 'editor' && now.deck.id === snapshot.deck.id)
          await setCurrentProjectId(snapshot.deck.id);
      },
    });
    // AI image placeholders get openly licensed stock photos, in the browser (D57).
    startPhotoFiller(store);
    // Each picture is described once so the text-only chat model knows what it shows (D58).
    startCaptioner(store);
  })();
  return booted;
}

/** Is this project the one loaded in the editor? */
export const isOpen = (store, id) =>
  store.getState().screen === 'editor' && store.getState().deck.id === id;

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

/**
 * Leave the open project (the StartScreen route): save it, stop an AI run still going (Back
 * pressed mid-generation), and reset to an empty deck. The project stays saved.
 */
export const closeProject = (store, ...args) => serial(() => closeProjectNow(store, ...args));
async function closeProjectNow(store) {
  const s = store.getState();
  if (s.aiBusy) stopAi();
  if (s.screen === 'start') return refreshProjects(store);
  await settle();
  s.replaceDeck(emptyDeck());
  s.clearChat();
  s.setScreen('start');
  await setCurrentProjectId(null);
  await refreshProjects(store);
}

export const openProject = (store, ...args) => serial(() => openProjectNow(store, ...args));
async function openProjectNow(store, id) {
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

/** @returns {Promise<string>} the new deck's id (navigate to it) */
export const startBlank = (store, ...args) => serial(() => startBlankNow(store, ...args));
async function startBlankNow(store) {
  await settle();
  const deck = emptyDeck();
  show(store, deck);
  return deck.id;
}

export const startFromSample = (store, ...args) => serial(() => startFromSampleNow(store, ...args));
async function startFromSampleNow(store) {
  await settle();
  const deck = { ...createSampleDeck(), id: newDeckId() }; // each copy is its own project
  show(store, deck);
  await saveProject({ deck, messages: [] });
  await setCurrentProjectId(deck.id);
  store.getState().setSaveStatus('saved');
  return deck.id;
}

/** Generation from the StartScreen: open the editor; the AI run creates the deck there. */
export const prepareForGeneration = (store, ...args) =>
  serial(() => prepareForGenerationNow(store, ...args));
async function prepareForGenerationNow(store) {
  await settle();
  const deck = emptyDeck();
  show(store, deck);
  return deck.id;
}

/**
 * Open a deck file (.json from "Export → Deck file") as a new project. The file is validated
 * like a stored deck; it gets a fresh id so importing the same file twice gives two projects.
 * @returns {Promise<{ ok: true, id: string } | { ok: false, message: string }>}
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
  return { ok: true, id: deck.id };
}
