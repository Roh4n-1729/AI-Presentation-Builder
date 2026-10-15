import { useEffect } from 'react';
import { isTypingTarget, scrollToSlide } from './dom.js';
import { getDeckState, useDeckActions } from './useDeck.js';

/**
 * Global editor shortcuts. Ctrl and Cmd both work. Text fields own their keys. The drag-cancel
 * Escape is handled earlier, in the capture phase, by CanvasMoveable (spike gotcha 3).
 */
export function useKeyboardShortcuts() {
  const actions = useDeckActions();
  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target)) return;
      const s = getDeckState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        actions.duplicateSelection();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        if (s.selection.length) {
          e.preventDefault();
          actions.deleteSelection();
        }
        return;
      }
      if (key === 'escape') {
        s.select(null);
        return;
      }
      if (key.startsWith('arrow')) {
        e.preventDefault();
        if (s.selection.length) {
          const step = e.shiftKey ? 40 : 8;
          const [dx, dy] = {
            arrowleft: [-step, 0],
            arrowright: [step, 0],
            arrowup: [0, -step],
            arrowdown: [0, step],
          }[key];
          actions.nudgeSelection(dx, dy);
        } else {
          const order = s.deck.slideOrder;
          const i = order.indexOf(s.activeSlideId);
          const next = key === 'arrowdown' || key === 'arrowright' ? i + 1 : i - 1;
          if (order[next]) scrollToSlide(order[next]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);
}
