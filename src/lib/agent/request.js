/**
 * Request contract (D13, §8b.5): never send image bytes to /api. Each image `src` becomes a short
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
      elements[id] = el.type === 'image' && el.src ? { ...el, src: `img:${id}` } : el;
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
