import { useEffect } from 'react';
import {
  CLIPBOARD_MIME,
  copyPayload,
  payloadText,
  pasteOps,
  readPayload,
} from '@/lib/clipboard.js';
import { findElement } from '@/lib/ops/index.js';
import { looksLikeGrid, parseGrid, tableFromGrid } from '@/lib/tabular.js';
import { appStore } from '@/store/index.js';
import * as actions from '@/store/actions.js';
import { isTypingTarget } from './dom.js';
import { insertImageFromFile } from './useInsert.js';

// The last copy made here. Browsers that drop the custom clipboard type still hand back our
// plain-text version; matching it means "paste what was just copied".
let lastCopy = null; // { json, text }
let repeat = { copyId: null, slideId: null, n: 0 };

const editorFocused = (e) => {
  const s = appStore.getState();
  return (
    s.screen === 'editor' &&
    !s.presenting &&
    !s.printing &&
    !isTypingTarget(e.target) &&
    !isTypingTarget(document.activeElement)
  );
};

function copySelection(e, cut) {
  const s = appStore.getState();
  if (!editorFocused(e) || !s.selection.length) return; // nothing selected: the browser's copy
  const hit = findElement(s.deck, s.selection[0]);
  const payload = hit && copyPayload(s.deck, hit.slide.id, s.selection);
  if (!payload) return;
  e.preventDefault();
  const json = JSON.stringify(payload);
  const text = payloadText(payload) || ' ';
  e.clipboardData.setData(CLIPBOARD_MIME, json);
  e.clipboardData.setData('text/plain', text); // other apps get the words, not our JSON
  lastCopy = { json, text };
  // Cut = copy + delete, one undo step for the delete. Locked elements are copied but stay
  // (the delete is refused and the usual error toast says why).
  if (cut) actions.deleteSelection(appStore);
}

/** Elements copied here → new copies on the slide in view, selected. */
function pasteElements(payload) {
  const s = appStore.getState();
  const slideId = s.deck.slides[s.activeSlideId] ? s.activeSlideId : s.deck.slideOrder[0];
  if (!slideId) return;
  // First paste onto another slide keeps the position; onto the same slide, or again, it steps.
  const again = repeat.copyId === payload.copyId && repeat.slideId === slideId;
  const n = again ? repeat.n + 1 : payload.slideId === slideId ? 1 : 0;
  repeat = { copyId: payload.copyId, slideId, n };
  const { ops, ids } = pasteOps(payload, slideId, n);
  const res = s.dispatch(ops, {
    label: ids.length > 1 ? `Paste ${ids.length} elements` : 'Paste',
  });
  if (!res.ok) return;
  s.setSelection(ids);
  s.showInCanvas({ slideId, elementIds: ids, label: 'Paste' });
}

function onPaste(e) {
  if (!editorFocused(e)) return; // typing in a field: the browser pastes text there
  const data = e.clipboardData;
  let raw = data.getData(CLIPBOARD_MIME);
  const text = data.getData('text/plain');
  if (!raw && lastCopy && text === lastCopy.text) raw = lastCopy.json;
  const payload = raw && readPayload(raw);
  if (payload) {
    e.preventDefault();
    pasteElements(payload);
    return;
  }
  const image = [...data.files].find((f) => f.type.startsWith('image/'));
  if (image) {
    e.preventDefault();
    insertImageFromFile(image, 'Paste image').catch((err) =>
      // Same toast as a refused edit.
      appStore.setState({
        lastError: { code: 'INVALID', message: err.message, label: 'Paste image', at: Date.now() },
      }),
    );
    return;
  }
  if (!text.trim()) return;
  e.preventDefault();
  if (looksLikeGrid(text)) {
    // Cells from a spreadsheet: a table, ready to edit (D53).
    const id = actions.insertElement(
      appStore,
      { type: 'table', rows: tableFromGrid(parseGrid(text)), headerRow: true },
      'Paste table',
    );
    if (id) appStore.getState().openDrawer(id);
    return;
  }
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((t) => ({ text: t.slice(0, 2000) }));
  actions.insertElement(
    appStore,
    { type: 'text', role: 'body', paragraphs, style: {} },
    'Paste text',
  );
}

/**
 * Ctrl/Cmd+C, X, V on the canvas (D53), through the browser's clipboard events, so there's no
 * permission prompt and copies survive between tabs. Fields keep normal text copy/paste.
 * Pastes: our elements (new ids, groups kept), an image file, spreadsheet cells (a table), or
 * plain text (a text box). Mount once, in the editor.
 */
export function useClipboard() {
  useEffect(() => {
    const onCopy = (e) => copySelection(e, false);
    const onCut = (e) => copySelection(e, true);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}
