import { elementId as newElementId, groupId as newGroupId } from './ids.js';
import { remapGroups } from './groups.js';
import { clampBBox } from './layout/index.js';

/**
 * Copy / paste of elements (D53). Pure: what goes on the clipboard, and the ops a paste becomes.
 * The browser side (clipboard events, images, plain text) is hooks/useClipboard.js.
 */

// Custom type on the copy event's DataTransfer: survives copy → paste within the browser.
export const CLIPBOARD_MIME = 'application/x-aipb-elements+json';
export const CLIPBOARD_FORMAT = 'ai-presentation-builder/elements';
const PASTE_STEP = 40; // each repeated paste on the same slide lands one step down and right

/**
 * The selection as a clipboard payload: whole elements in z-order (so a paste stacks them the
 * same way), and the slide they came from (a paste back onto it is offset, not on top).
 * @param {import('./schema/deck.js').Deck} deck
 * @param {string} slideId
 * @param {string[]} ids
 */
export function copyPayload(deck, slideId, ids) {
  const slide = deck.slides[slideId];
  if (!slide) return null;
  const elements = slide.elementOrder
    .filter((id) => ids.includes(id))
    .map((id) => structuredClone(slide.elements[id]));
  if (!elements.length) return null;
  // copyId: repeated pastes of the same copy cascade instead of stacking exactly.
  const copyId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { format: CLIPBOARD_FORMAT, version: 1, copyId, slideId, elements };
}

/** A clipboard string → payload, or null if it isn't ours (or is malformed). */
export function readPayload(text) {
  try {
    const p = JSON.parse(text);
    return p?.format === CLIPBOARD_FORMAT && Array.isArray(p.elements) && p.elements.length
      ? p
      : null;
  } catch {
    return null;
  }
}

/** Plain-text version for pasting into other apps: the text of text/table elements. */
export function payloadText(payload) {
  return payload.elements
    .map((el) => {
      if (el.type === 'text') return el.paragraphs.map((p) => p.text).join('\n');
      if (el.type === 'table') return el.rows.map((r) => r.join('\t')).join('\n');
      if (el.type === 'chart') return el.chart.title ?? 'Chart';
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Ops that paste `payload` onto `slideId`: fresh element ids, copied groups become new groups,
 * layout slots dropped (placed by hand now). Boxes keep their position, shifted `repeat` steps
 * when pasting onto the slide they came from (or repeatedly), and clamped to the artboard.
 * @returns {{ ops: object[], ids: string[] }}
 */
export function pasteOps(
  payload,
  slideId,
  repeat = 0,
  mint = { element: newElementId, group: newGroupId },
) {
  const shift = PASTE_STEP * repeat;
  const groups = remapGroups(payload.elements, mint.group);
  const ids = [];
  const ops = payload.elements.map((src) => {
    const id = mint.element();
    ids.push(id);
    const el = structuredClone(src);
    delete el.slot;
    el.id = id;
    if (el.groupId) el.groupId = groups[el.groupId];
    el.bbox = clampBBox({ ...el.bbox, x: el.bbox.x + shift, y: el.bbox.y + shift });
    return { type: 'add_element', slideId, element: el };
  });
  return { ops, ids };
}
