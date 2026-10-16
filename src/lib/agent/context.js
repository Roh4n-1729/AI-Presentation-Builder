import { kindOf } from '../layout/place.js';

/*
 * The compact deck description sent with every AI request (D13). Rebuilt from the store on every
 * turn, so manual edits (a chart dragged to another slide) are always what the model sees.
 * Text is truncated and image data never included; `get_slide` returns full content on demand.
 */

const clip = (s, n = 80) => {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const box = (b) => `(${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)})`;

/** One line per element: id, kind, box, a content preview. */
export function describeElement(el) {
  const flags = [
    el.locked && 'locked',
    el.slot && `slot=${el.slot}`,
    el.groupId && `group=${el.groupId}`,
  ]
    .filter(Boolean)
    .join(' ');
  const head = `${el.id} ${el.type === 'text' ? `text/${el.role}` : el.type} ${box(el.bbox)}${flags ? ` ${flags}` : ''}`;
  switch (el.type) {
    case 'text':
      return `${head} "${clip(el.paragraphs.map((p) => (p.bullet ? `• ${p.text}` : p.text)).join(' '))}"`;
    case 'chart': {
      const c = el.chart;
      const series = c.series.map((s) => `${s.name}:${s.values.join(',')}`).join('; ');
      return `${head} ${c.kind} "${clip(c.title ?? '', 50)}" cats=[${c.categories.join(',')}] series=[${clip(series, 160)}]`;
    }
    case 'table':
      return `${head} ${el.rows.length}x${el.rows[0]?.length ?? 0} header=[${clip(el.rows[0]?.join(', '), 80)}]`;
    case 'image':
      // What the picture shows (D58) when a vision model has described it; else alt / query.
      return `${head} "${clip(el.alt || el.query || 'image', 60)}"${el.src ? '' : ' (placeholder)'}${
        el.description?.text ? ` shows: "${clip(el.description.text, 240)}"` : ''
      }`;
    case 'shape':
      return `${head} ${el.shape} fill=${el.fill}`;
    default:
      return head;
  }
}

/**
 * @param {import('../schema/deck.js').Deck} deck
 * @param {{ activeSlideId?: string|null, selection?: string[] }} [view]
 */
export function serializeDeck(deck, view = {}) {
  const n = deck.slideOrder.length;
  const lines = [
    `Deck "${deck.title}" (${n} slide${n === 1 ? '' : 's'}, theme ${deck.theme}). Artboard 1920x1080.`,
  ];
  const active = view.activeSlideId && deck.slides[view.activeSlideId];
  if (active)
    lines.push(`User is viewing slide ${deck.slideOrder.indexOf(active.id) + 1} (${active.id}).`);
  const selected = (view.selection ?? []).filter((id) =>
    deck.slideOrder.some((s) => deck.slides[s].elements[id]),
  );
  if (selected.length) {
    const kinds = selected.map((id) => {
      const s = deck.slideOrder.find((sid) => deck.slides[sid].elements[id]);
      return `${id} (${kindOf(deck.slides[s].elements[id])} on slide ${deck.slideOrder.indexOf(s) + 1})`;
    });
    lines.push(`User has selected: ${kinds.join(', ')}. "this"/"it" usually means the selection.`);
  }
  if (n === 0) lines.push('The deck is empty.');
  deck.slideOrder.forEach((sid, i) => {
    const s = deck.slides[sid];
    lines.push(
      `[${i + 1}] ${sid} "${clip(s.title, 60)}" layout=${s.layout}${s.notes ? ' (has notes)' : ''}`,
    );
    for (const id of s.elementOrder) lines.push(`    ${describeElement(s.elements[id])}`);
    if (s.elementOrder.length === 0) lines.push('    (no elements)');
  });
  return lines.join('\n');
}
