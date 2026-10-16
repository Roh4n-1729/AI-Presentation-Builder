/**
 * Element groups (D53): elements that share a `groupId` on one slide. Selecting any member
 * selects the whole group; a group moves, copies and deletes as one. Pure helpers.
 */

/** Members of `groupId` on `slide`, in z-order. */
export const groupMembers = (slide, groupId) =>
  groupId ? slide.elementOrder.filter((id) => slide.elements[id]?.groupId === groupId) : [];

/**
 * `ids` plus every other member of their groups, in z-order, no duplicates. Ids that aren't on
 * `slide` are dropped (a selection lives on one slide).
 */
export function expandToGroups(slide, ids) {
  const want = new Set();
  for (const id of ids) {
    const el = slide.elements[id];
    if (!el) continue;
    want.add(id);
    for (const m of groupMembers(slide, el.groupId)) want.add(m);
  }
  return slide.elementOrder.filter((id) => want.has(id));
}

/**
 * The selection's group state, for the toolbar: `groupId` when the selection is exactly one
 * whole group; `canGroup` when 2+ elements aren't already exactly one group.
 */
export function groupState(slide, ids) {
  const groups = new Set(ids.map((id) => slide.elements[id]?.groupId ?? null));
  const only = groups.size === 1 ? [...groups][0] : null;
  const isOneGroup =
    only !== null && groupMembers(slide, only).length === ids.length && ids.length > 1;
  return { groupId: isOneGroup ? only : null, canGroup: ids.length > 1 && !isOneGroup };
}

/**
 * New group ids for a copy of `elements` (duplicate, paste): members that were grouped together
 * stay grouped together, in a new group, never joining the original. Returns old → new.
 * @param {{ groupId?: string }[]} elements
 * @param {() => string} mint
 */
export function remapGroups(elements, mint) {
  const map = {};
  for (const el of elements) if (el.groupId && !map[el.groupId]) map[el.groupId] = mint();
  return map;
}
