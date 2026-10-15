import { resolveColor } from './resolveColor.js';

/** Theme defaults per text role; an element's own `style` fields override them. */
const ROLE_DEFAULTS = {
  title: {
    font: 'heading',
    size: 'title',
    weight: 400,
    color: 'text',
    lineHeight: 'heading',
    tracking: '-0.01em',
  },
  subtitle: {
    font: 'body',
    size: 'subtitle',
    weight: 400,
    color: 'muted',
    lineHeight: 'body',
    tracking: '-0.005em',
  },
  body: {
    font: 'body',
    size: 'body',
    weight: 400,
    color: 'text',
    lineHeight: 'body',
    tracking: '0',
  },
  caption: {
    font: 'body',
    size: 'caption',
    weight: 400,
    color: 'muted',
    lineHeight: 'body',
    tracking: '0',
  },
};

/**
 * Resolved text style for a text element: plain values (artboard units, CSS colors) that the DOM
 * renderer, the print view and the PPTX exporter all read, so they can't drift apart (D6).
 *
 * @param {import('../schema/elements.js').TextElement} el
 * @param {import('./themes.js').SlideTheme} theme
 */
export function textStyleFor(el, theme) {
  const d = ROLE_DEFAULTS[el.role] ?? ROLE_DEFAULTS.body;
  const s = el.style ?? {};
  const font = s.font ?? d.font;
  return {
    fontFamily: theme.fonts[font],
    fontSize: s.fontSize ?? theme.type[d.size],
    fontWeight: s.fontWeight ?? d.weight,
    color: resolveColor(s.color ?? d.color, theme),
    lineHeight: font === 'heading' ? theme.lineHeight.heading : theme.lineHeight[d.lineHeight],
    letterSpacing: d.tracking,
    textAlign: s.align ?? 'left',
    bulletColor: resolveColor('accent', theme),
  };
}
