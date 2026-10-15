import { memo } from 'react';
import { ARTBOARD_H, ARTBOARD_W } from '@/lib/constants.js';
import { resolveColor } from '@/lib/theme/index.js';
import { ElementView } from './ElementView.jsx';

/**
 * The ONLY thing that draws a slide (D6): canvas, thumbnails, present mode and print all use it.
 * Draws at 1920×1080; the parent scales it. Inline styles from schema + theme only (no Tailwind
 * classes), so print and PPTX export read exactly the same values.
 *
 * @param {{ slide: object, theme: object, editingId?: string|null, artboardRef?: any }} props
 */
export const SlideRenderer = memo(function SlideRenderer({
  slide,
  theme,
  editingId = null,
  artboardRef,
}) {
  return (
    <div
      ref={artboardRef}
      className="artboard"
      style={{
        position: 'absolute',
        inset: 0,
        width: ARTBOARD_W,
        height: ARTBOARD_H,
        background: resolveColor(slide.background?.color, theme, 'bg'),
        fontFamily: theme.fonts.body,
        color: resolveColor('text', theme),
      }}
    >
      {slide.elementOrder.map((id) => (
        <ElementView key={id} el={slide.elements[id]} theme={theme} editing={editingId === id} />
      ))}
    </div>
  );
});
