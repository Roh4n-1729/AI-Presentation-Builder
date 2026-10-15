/**
 * What did a history entry touch? Derived from Immer patch paths, so it works for every op
 * without per-op bookkeeping. Used after undo/redo to scroll to and highlight the change.
 *
 * Paths look like:
 *   ['slides', sid, 'elements', elId, 'bbox', 'x']   element field
 *   ['slides', sid, 'elementOrder', 2]               z-order (value = element id; neighbours shift too)
 *   ['slides', sid, 'title']                         slide field
 *   ['slides', sid]                                  whole slide added/removed
 *   ['slideOrder', 3]                                slide order (value = slide id)
 *   ['title'] / ['theme']                            deck field
 *
 * @param {import('immer').Patch[]} patches
 * @returns {{ slideIds: string[], elementIds: string[] }}
 */
export function touchedIds(patches) {
  const slideIds = new Set();
  const elementIds = new Set(); // edited, added or removed: under `elements`
  const reordered = new Set(); // only seen in `elementOrder` (splice shifts neighbours too)
  for (const { path, value } of patches) {
    if (path[0] === 'slides' && typeof path[1] === 'string') {
      slideIds.add(path[1]);
      if (path[2] === 'elements' && typeof path[3] === 'string') elementIds.add(path[3]);
      if (path[2] === 'elementOrder' && typeof value === 'string') reordered.add(value);
    } else if (path[0] === 'slideOrder' && typeof value === 'string') {
      slideIds.add(value);
    }
  }
  // Pure z-order change: no element was edited, so the order values are the best signal we have.
  const ids = elementIds.size ? elementIds : reordered;
  return { slideIds: [...slideIds], elementIds: [...ids] };
}

/**
 * Where to point the user after undo/redo, in the deck as it is NOW: the first slide that holds a
 * touched element (and those elements on it), else the first touched slide that still exists.
 *
 * @param {import('../lib/schema/deck.js').Deck} deck  deck after the undo/redo
 * @param {import('immer').Patch[][]} patchLists  both directions of the entry (covers adds and removes)
 * @returns {{ slideId: string, elementIds: string[] } | null}
 */
export function revealTarget(deck, patchLists) {
  const ids = { slideIds: new Set(), elementIds: new Set() };
  for (const list of patchLists) {
    const t = touchedIds(list);
    t.slideIds.forEach((id) => ids.slideIds.add(id));
    t.elementIds.forEach((id) => ids.elementIds.add(id));
  }
  for (const sid of deck.slideOrder) {
    const here = [...ids.elementIds].filter((id) => deck.slides[sid].elements[id]);
    if (here.length) return { slideId: sid, elementIds: here };
  }
  const slideId = deck.slideOrder.find((sid) => ids.slideIds.has(sid));
  return slideId ? { slideId, elementIds: [] } : null;
}
