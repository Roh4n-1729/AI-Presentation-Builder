/*
 * Layout slots (D9). LLMs place boxes poorly, so an element added without a bbox goes into the
 * first free slot of the slide's layout that accepts its kind. `maxChars` is the text budget we
 * give the model in tool descriptions. Geometry is in artboard units (1920×1080): 96 side margin,
 * title band at the top, content from y≈250.
 *
 * Kinds: text roles ('title' | 'subtitle' | 'body' | 'caption') and element types
 * ('chart' | 'table' | 'image' | 'shape').
 */

const TITLE_BAR = {
  name: 'title',
  bbox: { x: 96, y: 72, w: 1728, h: 150 },
  accepts: ['title'],
  maxChars: 70,
};
const VISUAL = ['chart', 'table', 'image'];

/** Top of the content area on layouts with a title band: auto-placed content stays below it. */
export const CONTENT_TOP = 228;

/** @type {Record<import('../schema/deck.js').Layout, { label: string, slots: { name: string, bbox: import('../schema/elements.js').BBox, accepts: string[], maxChars?: number }[] }>} */
export const LAYOUT_DEFS = {
  title: {
    label: 'Title',
    slots: [
      {
        name: 'title',
        bbox: { x: 160, y: 330, w: 1600, h: 240 },
        accepts: ['title'],
        maxChars: 70,
      },
      {
        name: 'subtitle',
        bbox: { x: 160, y: 600, w: 1600, h: 150 },
        accepts: ['subtitle', 'body'],
        maxChars: 140,
      },
    ],
  },
  section: {
    label: 'Section break',
    slots: [
      {
        name: 'title',
        bbox: { x: 160, y: 400, w: 1600, h: 200 },
        accepts: ['title'],
        maxChars: 60,
      },
      {
        name: 'subtitle',
        bbox: { x: 160, y: 630, w: 1600, h: 120 },
        accepts: ['subtitle', 'body'],
        maxChars: 120,
      },
    ],
  },
  content: {
    label: 'Content',
    slots: [
      TITLE_BAR,
      // One-line lead under the title (a subtitle or key figure). Content starts below it, so a
      // lead added before or after the body never overlaps it (D41).
      {
        name: 'lead',
        bbox: { x: 96, y: 228, w: 1728, h: 76 },
        accepts: ['subtitle'],
        maxChars: 90,
      },
      {
        name: 'body',
        bbox: { x: 96, y: 320, w: 1728, h: 660 },
        accepts: ['body', 'caption', ...VISUAL],
        maxChars: 600,
      },
    ],
  },
  'two-column': {
    label: 'Two columns',
    slots: [
      TITLE_BAR,
      // Optional column headings, then the columns below them (D41).
      {
        name: 'leftHeading',
        bbox: { x: 96, y: 228, w: 840, h: 76 },
        accepts: ['subtitle'],
        maxChars: 45,
      },
      {
        name: 'rightHeading',
        bbox: { x: 984, y: 228, w: 840, h: 76 },
        accepts: ['subtitle'],
        maxChars: 45,
      },
      {
        name: 'left',
        bbox: { x: 96, y: 320, w: 840, h: 660 },
        accepts: ['body', ...VISUAL],
        maxChars: 320,
      },
      {
        name: 'right',
        bbox: { x: 984, y: 320, w: 840, h: 660 },
        accepts: ['body', ...VISUAL],
        maxChars: 320,
      },
    ],
  },
  comparison: {
    label: 'Comparison',
    slots: [
      TITLE_BAR,
      {
        name: 'leftHeading',
        bbox: { x: 96, y: 236, w: 840, h: 90 },
        accepts: ['subtitle'],
        maxChars: 40,
      },
      {
        name: 'rightHeading',
        bbox: { x: 984, y: 236, w: 840, h: 90 },
        accepts: ['subtitle'],
        maxChars: 40,
      },
      {
        name: 'left',
        bbox: { x: 96, y: 360, w: 840, h: 620 },
        accepts: ['body', ...VISUAL],
        maxChars: 280,
      },
      {
        name: 'right',
        bbox: { x: 984, y: 360, w: 840, h: 620 },
        accepts: ['body', ...VISUAL],
        maxChars: 280,
      },
    ],
  },
  'chart-focus': {
    label: 'Chart focus',
    slots: [
      TITLE_BAR,
      {
        name: 'lead',
        bbox: { x: 96, y: 228, w: 1728, h: 76 },
        accepts: ['subtitle'],
        maxChars: 90,
      },
      { name: 'visual', bbox: { x: 96, y: 320, w: 1100, h: 670 }, accepts: VISUAL },
      {
        name: 'body',
        bbox: { x: 1260, y: 330, w: 564, h: 640 },
        accepts: ['body', 'caption'],
        maxChars: 280,
      },
    ],
  },
  blank: { label: 'Blank', slots: [] },
};

/** Default size when an element of this kind is placed outside any slot. */
export const DEFAULT_SIZES = {
  title: { w: 1600, h: 150 },
  subtitle: { w: 1400, h: 110 },
  body: { w: 840, h: 420 },
  caption: { w: 700, h: 80 },
  chart: { w: 1000, h: 620 },
  table: { w: 1000, h: 480 },
  image: { w: 800, h: 560 },
  shape: { w: 360, h: 240 },
};
