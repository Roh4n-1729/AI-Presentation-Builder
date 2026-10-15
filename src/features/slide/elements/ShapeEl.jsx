import { resolveColor } from '@/lib/theme/index.js';

export function ShapeEl({ el, theme }) {
  const fill = resolveColor(el.fill, theme, 'accent');
  const stroke = el.stroke ? resolveColor(el.stroke, theme) : null;
  if (el.shape === 'line' || el.shape === 'arrow') {
    const { w, h } = el.bbox;
    const color = stroke ?? fill;
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        style={{ overflow: 'visible', display: 'block' }}
      >
        <defs>
          <marker
            id={`ah-${el.id}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 z" fill={color} />
          </marker>
        </defs>
        <line
          x1="0"
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke={color}
          strokeWidth={6}
          markerEnd={el.shape === 'arrow' ? `url(#ah-${el.id})` : undefined}
        />
      </svg>
    );
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: fill,
        border: stroke ? `4px solid ${stroke}` : 'none',
        borderRadius: el.shape === 'ellipse' ? '50%' : 16,
        boxSizing: 'border-box',
      }}
    />
  );
}
