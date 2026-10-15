// Hand-off between ElementView (pointerdown) and CanvasMoveable (mounts a frame later), so an
// unselected element can be clicked and dragged in one motion (spike gotcha 2). Only valid while
// the button is still held: if the user already released (a plain click), starting a drag would
// leave Moveable stuck "dragging" with no pointerup to end it.
let pending = null;
let pointerIsDown = false;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    () => {
      pointerIsDown = true;
    },
    true,
  );
  window.addEventListener(
    'pointerup',
    () => {
      pointerIsDown = false;
      pending = null;
    },
    true,
  );
  window.addEventListener(
    'pointercancel',
    () => {
      pointerIsDown = false;
      pending = null;
    },
    true,
  );
}

export const pendingDrag = {
  set: (id, event) => {
    pending = { id, event };
  },
  /** The pending event if it belongs to `elementId` (and clear it). */
  takeFor: (elementId) => {
    if (!pending || pending.id !== elementId) return null;
    const p = pending;
    pending = null;
    return p;
  },
  isPointerDown: () => pointerIsDown,
};
