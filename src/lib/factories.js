import { DEFAULT_THEME_ID } from './theme/themes.js';

/**
 * Plain constructors for new decks and slides. Ids are passed in (minted by the caller with
 * lib/ids.js), keeping these deterministic like applyOp.
 */

/** @returns {import('./schema/deck.js').Deck} */
export function createDeck({ id, title = 'Untitled presentation', theme = DEFAULT_THEME_ID }) {
  return { id, title, aspectRatio: '16:9', theme, slideOrder: [], slides: {} };
}

/** @returns {import('./schema/deck.js').Slide} */
export function createSlide({ id, title = 'Untitled slide', layout = 'blank', notes = '' }) {
  return { id, title, layout, background: { color: 'bg' }, notes, elementOrder: [], elements: {} };
}

/**
 * Starter content for elements inserted by hand (Insert menu). No id or box: the caller mints the
 * id and places it (placeElement), as for AI-added elements.
 * @param {'text'|'bullets'|'chart-bar'|'chart-line'|'chart-pie'|'table'|'rect'|'ellipse'|'line'|'arrow'} kind
 */
export function starterElement(kind) {
  switch (kind) {
    case 'text':
      return {
        type: 'text',
        role: 'body',
        paragraphs: [{ text: 'Double-click to edit' }],
        style: {},
      };
    case 'bullets':
      return {
        type: 'text',
        role: 'body',
        paragraphs: ['First point', 'Second point', 'Third point'].map((text) => ({
          text,
          bullet: true,
        })),
        style: {},
      };
    case 'chart-bar':
    case 'chart-line':
    case 'chart-pie':
      return {
        type: 'chart',
        chart: {
          kind: kind.slice(6),
          title: 'Chart title',
          categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [{ name: 'Series 1', values: [12, 19, 15, 24] }],
          showLegend: kind === 'chart-pie',
        },
      };
    case 'table':
      return {
        type: 'table',
        rows: [
          ['Item', 'Value', 'Notes'],
          ['', '', ''],
          ['', '', ''],
        ],
        headerRow: true,
      };
    default:
      return {
        type: 'shape',
        shape: kind,
        fill: kind === 'line' || kind === 'arrow' ? 'text' : 'accent',
      };
  }
}
