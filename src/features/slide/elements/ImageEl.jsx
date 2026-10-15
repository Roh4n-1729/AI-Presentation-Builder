import { ImageIcon } from 'lucide-react';
import { resolveColor } from '@/lib/theme/index.js';

/** A real image, or (no src yet) a styled placeholder that shows the AI's search query. */
export function ImageEl({ el, theme }) {
  if (el.src) {
    return (
      <img
        src={el.src}
        alt={el.alt}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: el.fit,
          display: 'block',
          borderRadius: 12,
          pointerEvents: 'none',
        }}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={el.alt || 'Image placeholder'}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        background: resolveColor('surface', theme),
        border: `3px dashed ${resolveColor('border', theme)}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: resolveColor('muted', theme),
        fontFamily: theme.fonts.body,
        fontSize: 26,
        textAlign: 'center',
        padding: 32,
        boxSizing: 'border-box',
      }}
    >
      <ImageIcon size={72} strokeWidth={1.25} />
      <span>{el.query || el.alt || 'Image'}</span>
    </div>
  );
}
