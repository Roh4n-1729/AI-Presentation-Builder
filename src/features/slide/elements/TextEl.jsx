import { useLayoutEffect, useRef, useState } from 'react';
import { textStyleFor } from '@/lib/theme/index.js';
import { stopEditorKeys, useSlideInteraction } from '../interaction.js';

/**
 * Largest font size (from `base` down to `min`, in 4% steps) at which the text fits its box.
 * Measures the real DOM node, so wrapping, fonts and bullets are exact. Module-level so the
 * inline-style writes stay outside the component (React Compiler rule).
 */
function fitFontSize(node, base, min) {
  const prev = node.style.fontSize;
  let size = base;
  node.style.fontSize = `${size}px`;
  while (node.scrollHeight > node.clientHeight + 1 && size > min) {
    size = Math.max(min, Math.floor(size * 0.96));
    node.style.fontSize = `${size}px`;
  }
  node.style.fontSize = prev;
  return size;
}

const fontsReady = typeof document !== 'undefined' && document.fonts ? document.fonts.ready : null;

/**
 * Auto-shrink (D41): text that doesn't fit its box is drawn smaller, never below the theme's
 * minimum, instead of being clipped. Render-time only: the stored font size is unchanged, so
 * growing the box (or shortening the text) brings it back to full size.
 */
function useFittedSize(ref, base, min, deps) {
  const [size, setSize] = useState(base);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let alive = true;
    const measure = () => alive && setSize(fitFontSize(node, base, min));
    measure();
    fontsReady?.then(measure); // re-measure once web fonts have loaded (metrics change)
    return () => {
      alive = false;
    };
  }, [ref, base, min, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps -- deps spread
  return size;
}

/** One paragraph per line; bullets and indent levels from the schema. */
export function TextEl({ el, theme, editing }) {
  const s = textStyleFor(el, theme);
  const ref = useRef(null);
  const fitted = useFittedSize(ref, s.fontSize, theme.type.min, [
    el.paragraphs,
    el.bbox.w,
    el.bbox.h,
    s.fontFamily,
    editing,
  ]);
  const box = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    fontFamily: s.fontFamily,
    fontSize: editing ? s.fontSize : fitted,
    fontWeight: s.fontWeight,
    color: s.color,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textAlign: s.textAlign,
    wordBreak: 'break-word',
  };
  if (editing) return <TextEditor el={el} box={box} />;
  return (
    <div ref={ref} style={box}>
      {el.paragraphs.map((p, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: '0.5em',
            paddingLeft: `${(p.level ?? 0) * 1.2}em`,
            marginBottom: i < el.paragraphs.length - 1 ? '0.35em' : 0,
            justifyContent: s.textAlign === 'center' ? 'center' : undefined,
          }}
        >
          {p.bullet && <span style={{ color: s.bulletColor }}>•</span>}
          <span style={{ flex: s.textAlign === 'center' ? undefined : 1, whiteSpace: 'pre-wrap' }}>
            {p.text || ' '}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Uncontrolled contentEditable (spike gotcha 6): React renders no children into it, so the
 * browser's own edits can't fight reconciliation. Text is set once on mount; blur commits one op.
 */
function TextEditor({ el, box }) {
  const ref = useRef(null);
  const ix = useSlideInteraction();

  useLayoutEffect(() => {
    const node = ref.current;
    node.innerText = el.paragraphs.map((p) => p.text).join('\n');
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- set once on entering edit mode

  const commit = () => {
    const lines = ref.current.innerText.replace(/\n$/, '').split('\n');
    // Keep each line's bullet/level; new lines inherit from the last paragraph.
    const last = el.paragraphs.at(-1) ?? {};
    const paragraphs = lines.map((text, i) => {
      const src = el.paragraphs[i] ?? { bullet: last.bullet, level: last.level };
      const p = { text };
      if (src.bullet) p.bullet = true;
      if (src.level) p.level = src.level;
      return p;
    });
    ix?.commitText(el, paragraphs);
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') ref.current.blur();
        stopEditorKeys(e);
      }}
      style={{ ...box, whiteSpace: 'pre-wrap', cursor: 'text', outline: 'none' }}
    />
  );
}
