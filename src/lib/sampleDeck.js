import { createDeck, createSlide } from './factories.js';
import { LAYOUT_DEFS } from './layout/layouts.js';

/*
 * A hand-written deck for the "Load sample deck" safety net (D23) and for developing the canvas
 * before the agent exists. Elements sit in their layout slots, like generated ones will.
 * Ids are fixed so tests and screenshots are stable.
 */

const slotBox = (layout, slot) => ({
  ...LAYOUT_DEFS[layout].slots.find((s) => s.name === slot).bbox,
});
const P = (text, bullet = false) => ({ text, ...(bullet ? { bullet: true } : {}) });

function slide(id, title, layout, elements, notes = '') {
  const s = createSlide({ id, title, layout, notes });
  for (const el of elements) {
    s.elements[el.id] = el;
    s.elementOrder.push(el.id);
  }
  return s;
}

const text = (id, layout, slot, role, paragraphs, style = {}) => ({
  id,
  type: 'text',
  role,
  slot,
  bbox: slotBox(layout, slot),
  paragraphs,
  style,
});

export function createSampleDeck() {
  const deck = createDeck({ id: 'd_sample', title: 'Q3 Product Roadmap' });
  const slides = [
    slide('s_intro', 'Q3 Product Roadmap', 'title', [
      text('el_intro_title', 'title', 'title', 'title', [P('Q3 Product Roadmap')], {
        fontSize: 120,
      }),
      text('el_intro_sub', 'title', 'subtitle', 'subtitle', [
        P('What we shipped, what comes next, and where the numbers are heading'),
      ]),
    ]),
    slide('s_bets', 'Three bets for Q3', 'content', [
      text('el_bets_title', 'content', 'title', 'title', [P('Three bets for Q3')]),
      text('el_bets_body', 'content', 'body', 'body', [
        P('Collaboration: live cursors and comments in every editor', true),
        P('Self-serve onboarding: first deck in under two minutes', true),
        P('Enterprise controls: SSO, audit log and data residency', true),
      ]),
    ]),
    slide('s_revenue', 'Revenue is compounding', 'chart-focus', [
      text('el_rev_title', 'chart-focus', 'title', 'title', [P('Revenue is compounding')]),
      {
        id: 'el_rev_chart',
        type: 'chart',
        slot: 'visual',
        bbox: slotBox('chart-focus', 'visual'),
        chart: {
          kind: 'bar',
          title: 'Quarterly revenue ($M)',
          categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: '2025', values: [4.2, 4.8, 5.1, 5.9] },
            { name: '2026', values: [5.6, 6.3, 6.7, 7.4] },
          ],
          showLegend: true,
        },
      },
      text('el_rev_body', 'chart-focus', 'body', 'body', [
        P('+31% year over year in Q3', true),
        P('Enterprise now 42% of revenue', true),
        P('Net revenue retention 118%', true),
      ]),
    ]),
    slide('s_pricing', 'Pricing tiers', 'two-column', [
      text('el_price_title', 'two-column', 'title', 'title', [P('Pricing tiers')]),
      {
        id: 'el_price_table',
        type: 'table',
        slot: 'left',
        bbox: { ...slotBox('two-column', 'left'), h: 256 }, // 4 rows × 64 (D56)
        headerRow: true,
        rows: [
          ['Plan', 'Price', 'Seats'],
          ['Starter', '$0', '1'],
          ['Team', '$12 / seat', 'up to 50'],
          ['Enterprise', 'Custom', 'Unlimited'],
        ],
      },
      text('el_price_body', 'two-column', 'right', 'body', [
        P('Team plan drives 61% of new revenue', true),
        P('Annual billing discount moves to 20%', true),
        P('Enterprise adds SSO and audit log', true),
      ]),
    ]),
    slide('s_usage', 'Weekly active teams', 'chart-focus', [
      text('el_usage_title', 'chart-focus', 'title', 'title', [P('Weekly active teams')]),
      {
        id: 'el_usage_chart',
        type: 'chart',
        slot: 'visual',
        bbox: slotBox('chart-focus', 'visual'),
        chart: {
          kind: 'line',
          title: 'Active teams (thousands)',
          categories: ['Jul', 'Aug', 'Sep', 'Oct'],
          series: [{ name: 'Active teams', values: [18, 22, 27, 31] }],
          showLegend: false,
        },
      },
      text('el_usage_body', 'chart-focus', 'body', 'body', [
        P('Growth doubled after self-serve onboarding launched in August', true),
      ]),
    ]),
    slide('s_next', 'Next steps', 'two-column', [
      text('el_next_title', 'two-column', 'title', 'title', [P('Next steps')]),
      text('el_next_body', 'two-column', 'left', 'body', [
        P('Ship comments to all plans by November', true),
        P('Run the enterprise pilot with three design partners', true),
        P('Review pricing after one quarter of data', true),
      ]),
      {
        id: 'el_next_image',
        type: 'image',
        slot: 'right',
        bbox: slotBox('two-column', 'right'),
        src: '',
        alt: 'Team planning session',
        fit: 'cover',
        query: 'team planning session whiteboard',
      },
    ]),
  ];
  for (const s of slides) {
    deck.slides[s.id] = s;
    deck.slideOrder.push(s.id);
  }
  return deck;
}
