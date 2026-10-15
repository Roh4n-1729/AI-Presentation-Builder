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
