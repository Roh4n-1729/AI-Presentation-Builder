import { useLayoutEffect, useRef } from 'react';
import { textStyleFor } from '@/lib/theme/index.js';
import { useSlideInteraction } from '../interaction.js';

/** One paragraph per line; bullets and indent levels from the schema. */
export function TextEl({ el, theme, editing }) {
  const s = textStyleFor(el, theme);
  const box = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    color: s.color,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textAlign: s.textAlign,
    wordBreak: 'break-word',
  };
  if (editing) return <TextEditor el={el} box={box} />;
  return (
    <div style={box}>
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
        e.stopPropagation(); // typing must not trigger canvas shortcuts
      }}
      style={{ ...box, whiteSpace: 'pre-wrap', cursor: 'text', outline: 'none' }}
    />
  );
}
