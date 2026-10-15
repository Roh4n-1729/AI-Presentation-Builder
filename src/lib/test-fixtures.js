import { createDeck, createSlide } from './factories.js';

/** Small hand-built deck for unit tests: 3 slides, a title, a body text and a chart. */
export function makeDeck() {
  const deck = createDeck({ id: 'd_test', title: 'Q3 Roadmap' });
  const a = createSlide({ id: 's_aaaaa', title: 'Intro', layout: 'title' });
  const b = createSlide({ id: 's_bbbbb', title: 'Revenue', layout: 'chart-focus' });
  const c = createSlide({ id: 's_ccccc', title: 'Next steps', layout: 'content' });

  a.elements.el_title = {
    id: 'el_title',
    type: 'text',
    role: 'title',
    slot: 'title',
    bbox: { x: 160, y: 330, w: 1600, h: 240 },
    paragraphs: [{ text: 'Q3 Roadmap' }],
    style: {},
  };
  a.elementOrder.push('el_title');

  b.elements.el_chart = {
    id: 'el_chart',
    type: 'chart',
    slot: 'visual',
    bbox: { x: 96, y: 250, w: 1100, h: 740 },
    chart: {
      kind: 'bar',
      title: 'Quarterly revenue',
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: '2026', values: [10, 12, 15, 18] }],
      showLegend: true,
    },
  };
  b.elements.el_body = {
    id: 'el_body',
    type: 'text',
    role: 'body',
    slot: 'body',
    bbox: { x: 1260, y: 270, w: 564, h: 700 },
    paragraphs: [{ text: '+31% YoY', bullet: true }],
    style: {},
  };
  b.elementOrder.push('el_chart', 'el_body');

  for (const s of [a, b, c]) {
    deck.slides[s.id] = s;
    deck.slideOrder.push(s.id);
  }
  return deck;
}

export const text = (id, extra = {}) => ({
  id,
  type: 'text',
  role: 'body',
  bbox: { x: 100, y: 100, w: 400, h: 200 },
  paragraphs: [{ text: id }],
  style: {},
  ...extra,
});
