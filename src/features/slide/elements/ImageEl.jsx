import { ImageIcon } from 'lucide-react';
import { cropLayout } from '@/lib/crop.js';
import { resolveColor } from '@/lib/theme/index.js';

/** A real image, or (no src yet) a styled placeholder that shows the AI's search query. */
export function ImageEl({ el, theme }) {
  if (el.src && el.crop && el.natural) {
    // Cropped (D53): the crop region covers the box; the clip box hides the rest of the source.
    const { w: W, h: H } = el.bbox;
    const { clip, img } = cropLayout(el.crop, el.natural, W, H, el.fit);
    // Percentages of the box (and of the clip), so the picture follows a live resize gesture;
    // it settles to the exact cover fit when the new box is committed.
    const pct = (v, of) => `${(v / of) * 100}%`;
    const clipStyle = {
      left: pct(clip.left, W),
      top: pct(clip.top, H),
      width: pct(clip.width, W),
      height: pct(clip.height, H),
    };
    const imgStyle = {
      left: pct(img.left, clip.width),
      top: pct(img.top, clip.height),
      width: pct(img.width, clip.width),
      height: pct(img.height, clip.height),
    };
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 12,
          pointerEvents: 'none',
        }}
      >
        <div style={{ position: 'absolute', overflow: 'hidden', borderRadius: 12, ...clipStyle }}>
          <img
            src={el.src}
            alt={el.alt}
            draggable={false}
            style={{ position: 'absolute', maxWidth: 'none', display: 'block', ...imgStyle }}
          />
        </div>
      </div>
    );
  }
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
