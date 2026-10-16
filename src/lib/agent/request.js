import { currentDescription } from '../imageInfo.js';

/**
 * Request contract (D13, §8b.5): never send image bytes with chat requests (the one exception is
 * /api/describe, which gets one small copy per picture, D58). Each image `src` becomes a short
 * reference (`img:<elementId>`); the server never needs pixels, and ops that copy images (duplicate,
 * move with newId) copy from the client's own deck, so nothing is lost. Keeps requests far below
 * Vercel's 4.5 MB body limit and token counts low.
 *
 * @param {import('../schema/deck.js').Deck} deck
 */
export function toRequestDeck(deck) {
  const slides = {};
  for (const sid of deck.slideOrder) {
    const s = deck.slides[sid];
    const elements = {};
    for (const id of s.elementOrder) {
      const el = s.elements[id];
      if (el.type === 'image' && el.src) {
        // The description travels as text; a stale one (picture replaced since) is dropped (D58).
        const { description, ...rest } = el;
        const text = currentDescription(el);
        elements[id] = {
          ...rest,
          src: `img:${id}`,
          ...(text ? { description: { text, of: description.of } } : {}),
        };
      } else elements[id] = el;
    }
    const background = s.background?.imageSrc
      ? { ...s.background, imageSrc: `img:${sid}` }
      : s.background;
    slides[sid] = { ...s, background, elements };
  }
  return { ...deck, slides };
}

/** Rough request size guard: Vercel rejects bodies over 4.5 MB. */
export const MAX_REQUEST_BYTES = 4_000_000;
