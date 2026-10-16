import {
  buildPptxModel,
  EXPORT_FONT_CSS,
  TABLE_FONT_UNITS,
  writePptx,
} from '../lib/export/pptx.js';
import { getTheme, textStyleFor } from '../lib/theme/index.js';

/*
 * Browser half of the PowerPoint export (D44). lib/export/pptx.js maps the deck to pptxgenjs
 * calls; this file supplies what needs a browser:
 *   1. text fit re-measured with the fonts the .pptx will actually use (Cambria/Arial), so a title
 *      that fit in Instrument Serif doesn't overflow in a wider substitute font; table cells too,
 *      so a compact table keeps its box (D72);
 *   2. images cropped (cover) or letterboxed (contain) to their box with the canvas's rounded
 *      corners, so PowerPoint shows the same framing;
 *   3. pptxgenjs itself, loaded on demand (it's ~400 KB; most sessions never export).
 */

const PARA_GAP = 0.35; // em between paragraphs, as in TextEl
const RADIUS = 12; // image corner radius on the canvas (artboard units)

/** Largest size (≤ base, ≥ min, 4% steps) at which the paragraphs fit the box in `family`. */
function measureFit(host, el, style, family) {
  const node = document.createElement('div');
  Object.assign(node.style, {
    position: 'absolute',
    width: `${el.bbox.w}px`,
    height: `${el.bbox.h}px`,
    overflow: 'hidden',
    fontFamily: family,
    fontWeight: String(style.fontWeight),
    lineHeight: String(style.lineHeight),
    wordBreak: 'break-word',
  });
  el.paragraphs.forEach((p, i) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '0.5em';
    row.style.paddingLeft = `${(p.level ?? 0) * 1.2}em`;
    row.style.marginBottom = i < el.paragraphs.length - 1 ? `${PARA_GAP}em` : '0';
    if (p.bullet)
      row.appendChild(Object.assign(document.createElement('span'), { textContent: '•' }));
    const t = document.createElement('span');
    t.style.flex = '1';
    t.style.whiteSpace = 'pre-wrap';
    t.textContent = p.text || ' ';
    row.appendChild(t);
    node.appendChild(row);
  });
  host.appendChild(node);
  let size = style.fontSize;
  const min = Math.min(style.fontSize, 22);
  node.style.fontSize = `${size}px`;
  while (node.scrollHeight > node.clientHeight + 1 && size > min) {
    size = Math.max(min, Math.floor(size * 0.96));
    node.style.fontSize = `${size}px`;
  }
  node.remove();
  return size;
}

const TABLE_MIN_UNITS = 18; // as TableEl: tables may shrink further than body text

/**
 * Largest cell size (≤ 28, ≥ 18 units) at which the table's rows fit its box in `family`, and
 * each row's height at that size, stretched to fill the box as the canvas does (a row whose text
 * wraps stays taller). @returns {{ size: number, rowH: number[] }}
 */
function measureTableFit(host, el, family) {
  const node = document.createElement('table');
  Object.assign(node.style, {
    position: 'absolute',
    width: `${el.bbox.w}px`,
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontFamily: family,
    lineHeight: '1.3',
    wordBreak: 'break-word',
  });
  for (const [r, row] of el.rows.entries()) {
    const tr = node.insertRow();
    tr.style.height = '2.2em'; // one line plus padding, as TableEl
    for (const cell of row) {
      const td = tr.insertCell();
      td.style.padding = '0.45em 0.7em';
      td.style.border = '2px solid transparent';
      td.style.whiteSpace = 'pre-wrap';
      if (el.headerRow && r === 0) td.style.fontWeight = '600';
      td.textContent = cell || ' ';
    }
  }
  host.appendChild(node);
  let size = TABLE_FONT_UNITS;
  node.style.fontSize = `${size}px`;
  while (node.offsetHeight > el.bbox.h + 1 && size > TABLE_MIN_UNITS) {
    size = Math.max(TABLE_MIN_UNITS, Math.floor(size * 0.96));
    node.style.fontSize = `${size}px`;
  }
  const heights = [...node.rows].map((tr) => tr.offsetHeight);
  const total = heights.reduce((a, b) => a + b, 0) || 1;
  node.remove();
  // Share the box in proportion to each row's content. (If the text still overflows at the
  // smallest size, PowerPoint grows the rows; the canvas clips them.)
  return { size, rowH: heights.map((h) => (h * el.bbox.h) / total) };
}

function fitAllText(deck, theme) {
  const host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    visibility: 'hidden',
  });
  document.body.appendChild(host);
  const fitted = {};
  try {
    for (const sid of deck.slideOrder) {
      for (const el of Object.values(deck.slides[sid].elements)) {
        if (el.type === 'table') {
          fitted[el.id] = measureTableFit(host, el, EXPORT_FONT_CSS.body);
          continue;
        }
        if (el.type !== 'text') continue;
        const style = textStyleFor(el, theme);
        const role = style.fontFamily === theme.fonts.heading ? 'heading' : 'body';
        fitted[el.id] = measureFit(host, el, style, EXPORT_FONT_CSS[role]);
      }
    }
  } finally {
    host.remove();
  }
  return fitted;
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // remote images must allow CORS to be embedded
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image ${src.slice(0, 60)}`));
    img.src = src;
  });

/** Draw the image into its box exactly as the canvas shows it (object-fit + rounded corners). */
async function frameImage(el) {
  const img = await loadImage(el.src);
  const { w, h } = el.bbox;
  // Enough pixels for the box, never more than the source has, capped at 1600 on the long side.
  const k = Math.min(1600 / Math.max(w, h), Math.max(1, img.naturalWidth / w));
  const cw = Math.round(w * k);
  const ch = Math.round(h * k);
  const canvas = Object.assign(document.createElement('canvas'), { width: cw, height: ch });
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, RADIUS * k);
  ctx.clip();
  // The source region shown: the crop (D53), or the whole picture.
  const c = el.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = c.x * img.naturalWidth;
  const sy = c.y * img.naturalHeight;
  const sw = c.w * img.naturalWidth;
  const sh = c.h * img.naturalHeight;
  const s = el.fit === 'contain' ? Math.min(cw / sw, ch / sh) : Math.max(cw / sw, ch / sh);
  const dw = sw * s;
  const dh = sh * s;
  ctx.drawImage(img, sx, sy, sw, sh, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  return canvas.toDataURL('image/png');
}

async function frameAllImages(deck) {
  const images = {};
  const problems = [];
  const jobs = [];
  for (const sid of deck.slideOrder) {
    for (const el of Object.values(deck.slides[sid].elements)) {
      if (el.type !== 'image' || !el.src) continue;
      jobs.push(
        frameImage(el).then(
          (data) => (images[el.id] = data),
          () => {
            images[el.id] = null; // placeholder in the file, reported to the user
            problems.push(el.alt || el.src.slice(0, 40));
          },
        ),
      );
    }
  }
  await Promise.all(jobs);
  return { images, problems };
}

const safeName = (title) =>
  (title || 'presentation')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

/**
 * Build and download the .pptx. Uses the deck's own theme (the dark display variant is a view
 * preference, not part of the deck).
 * @returns {Promise<{ fileName: string, problems: string[] }>}
 */
export async function exportPptx(deck) {
  const theme = getTheme(deck.theme);
  await document.fonts?.ready;
  const fitted = fitAllText(deck, theme);
  const { images, problems } = await frameAllImages(deck);
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pres = writePptx(PptxGenJS, deck, buildPptxModel(deck, theme, { fitted, images }));
  const fileName = `${safeName(deck.title)}.pptx`;
  await pres.writeFile({ fileName });
  return { fileName, problems };
}

/** Deck file (.json): the deck as stored, for backup or moving between browsers. */
export function exportDeckJson(deck) {
  const blob = new Blob(
    [JSON.stringify({ format: 'ai-presentation-builder', version: 1, deck }, null, 2)],
    {
      type: 'application/json',
    },
  );
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${safeName(deck.title)}.deck.json`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
