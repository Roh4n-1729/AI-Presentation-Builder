/**
 * Motion tokens for scripted animations (D48). The values live in CSS (`--motion-*` in
 * styles/index.css); this reads them so JS and CSS can never drift apart. Fallbacks only matter
 * when there is no DOM (tests).
 */

const FALLBACK_MS = { fast: 120, base: 200, move: 280, emphasis: 420, highlight: 1100 };
const FALLBACK_EASE = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0, 1)',
  exit: 'cubic-bezier(0.3, 0, 1, 1)',
};

const readVar = (name) =>
  typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The OS asked for less motion: scripted animations are skipped (CSS ones are made instant). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Duration of a motion token in ms ('fast' | 'base' | 'move' | 'emphasis' | 'highlight'),
 * 0 under reduced motion.
 * @param {keyof typeof FALLBACK_MS} name
 */
export function motionMs(name) {
  if (prefersReducedMotion()) return 0;
  const raw = readVar(`--motion-${name}`);
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return FALLBACK_MS[name] ?? 200;
  return raw.endsWith('ms') ? n : n * 1000;
}

/** Easing of a motion token as a CSS timing function ('standard' | 'enter' | 'exit'). */
export function motionEase(name) {
  return readVar(`--motion-ease-${name}`) || FALLBACK_EASE[name] || FALLBACK_EASE.standard;
}

/** Shorthand for Element.animate options: `el.animate(frames, motion('move', 'enter'))`. */
export function motion(duration, ease = 'standard') {
  return { duration: motionMs(duration), easing: motionEase(ease) };
}
