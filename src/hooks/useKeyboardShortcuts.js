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
      const s = getDeckState();
      if (s.presenting) return; // present mode owns the keyboard
      // Ctrl/Cmd+P prints the slides (the print view), not the editor screen.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (!s.printing) s.setPrinting(true);
        return;
      }
      // F5 presents from the start, Shift+F5 from the current slide (as in PowerPoint). Checked
      // before the text-field guard: F5 types nothing, and letting it through reloads the page.
      if (e.key === 'F5' && s.deck.slideOrder.length) {
        e.preventDefault();
        const index = e.shiftKey ? Math.max(0, s.deck.slideOrder.indexOf(s.activeSlideId)) : 0;
        s.setPresenting({ index });
        document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      // Ctrl/Cmd + [ and ] toggle the slides and AI panels (D40)
      if (mod && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        s.setPanel(e.key === '[' ? 'filmstrip' : 'chat');
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
