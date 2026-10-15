import { createContext, useContext } from 'react';

/**
 * How an interactive slide talks back to the editor. The canvas provides it; thumbnails, present
 * mode and print don't, so the same renderer stays read-only there (D6: renderer is props-only,
 * no store access).
 *
 * @typedef {{
 *   onElementPointerDown: (e: PointerEvent, el: object) => void,
 *   onElementDoubleClick: (el: object) => void,
 *   commitText: (el: object, paragraphs: object[]) => void,
 *   commitCell: (el: object, row: number, col: number, value: string) => void,
 *   endEdit: () => void,
 * }} SlideInteraction
 */
export const SlideInteractionContext = createContext(/** @type {SlideInteraction | null} */ (null));

export const useSlideInteraction = () => useContext(SlideInteractionContext);

/**
 * Keydown handler for inline editors (text boxes, table cells): typing must not reach the canvas
 * shortcuts, so the event stops here. Except F5 / Shift+F5 (present) and Ctrl/Cmd+P (print):
 * they type nothing, and if stopped the browser's own F5 reloads the page mid-edit.
 * @param {KeyboardEvent} e
 */
export function stopEditorKeys(e) {
  const appWide = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p');
  if (!appWide) e.stopPropagation();
}
