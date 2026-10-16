/**
 * Image descriptions (D58). A vision model describes each picture once; the description is stored
 * on the element with a fingerprint of the src it describes, so after a replace, undo or redo the
 * old text is ignored and the picture is described again.
 */

/** Short fingerprint of an image src (FNV-1a over the whole string, plus its length). */
export function srcFingerprint(src) {
  const s = String(src ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${s.length.toString(36)}-${h.toString(36)}`;
}

/** The description of the picture the element shows now, or '' if there is none (or it's stale). */
export function currentDescription(el) {
  if (el?.type !== 'image' || !el.src || !el.description) return '';
  return el.description.of === srcFingerprint(el.src) ? el.description.text : '';
}

/** Does this image still need a description? (A picture, and none for it yet.) */
export const needsDescription = (el) =>
  el?.type === 'image' && Boolean(el.src) && !currentDescription(el);
