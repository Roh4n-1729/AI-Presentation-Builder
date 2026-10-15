/** Scroll the slide column so slide `id` is centred. */
export const scrollToSlide = (id, behavior = 'smooth') =>
  document
    .querySelector(`[data-slide-frame="${id}"]`)
    ?.scrollIntoView({ behavior, block: 'center' });

/** True when keyboard focus is in a text field, so canvas shortcuts must not fire. */
export const isTypingTarget = (t) =>
  t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName);
