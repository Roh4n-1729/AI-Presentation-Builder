/**
 * Spreadsheet / CSV text → grids, charts and tables (D53). Copying cells from Excel, Google Sheets
 * or Numbers puts tab-separated text on the clipboard; a .csv opened as text is comma-separated.
 * Pure functions, shared by the chart editor, the table editor and canvas paste.
 */

/**
 * Parse delimited text into rows of cells. Tabs win when present (spreadsheet copy), else commas
 * or semicolons, whichever is more common. Quoted fields may contain the delimiter, newlines and
 * doubled quotes ("a ""b"""), as in RFC 4180. Trailing empty rows are dropped.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseGrid(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const delim = src.includes('\t')
    ? '\t'
    : (src.match(/;/g)?.length ?? 0) > (src.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  while (rows.length && rows.at(-1).every((c) => c === '')) rows.pop();
  return rows;
}

/** Text that is a grid (2+ rows or 2+ columns), not just a sentence with a comma in it. */
export function looksLikeGrid(text) {
  const t = String(text ?? '').trim();
  if (!t) return false;
  if (t.includes('\t')) return true;
  const rows = parseGrid(t);
  if (rows.length < 2) return false;
  const width = rows[0].length;
  return width >= 2 && rows.every((r) => r.length === width);
}

/**
 * A spreadsheet number: "1,200", "₹1,200", "$3.5", "12%", "(40)" → 1200, 1200, 3.5, 12, -40.
 * Returns NaN for anything that isn't a number.
 */
// Optional sign, up to 3 currency symbols (no letters, so "Q1" stays a label), grouped digits,
// optional decimals / exponent, optional %. Parentheses mean negative (accounting style).
const NUMBER =
  /^([-+])?\s*[^\w\s.,()-]{0,3}\s*([-+])?(\d{1,3}(?:,\d{3})+|\d*)(\.\d+)?(e[-+]?\d+)?\s*%?$/i;

export function parseNumber(s) {
  let t = String(s ?? '').trim();
  const negative = /^\(.+\)$/.test(t);
  if (negative) t = t.slice(1, -1).trim();
  const m = NUMBER.exec(t);
  if (!t || !m || (!m[3] && !m[4])) return NaN;
  const n = Number(`${m[3].replace(/,/g, '')}${m[4] ?? ''}${m[5] ?? ''}` || 'x');
  if (!Number.isFinite(n)) return NaN;
  const sign = (m[1] === '-') !== (m[2] === '-') ? -1 : 1;
  return (negative ? -1 : 1) * sign * n;
}

const isNum = (s) => Number.isFinite(parseNumber(s));
const isYear = (s) => /^(19|20)\d\d$/.test(String(s).trim());
const mostlyText = (cells) =>
  cells.length > 0 && cells.filter((c) => c && !isNum(c)).length >= cells.length / 2;

const pad = (rows) => {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(w - r.length).fill('')]);
};
const transpose = (rows) => rows[0].map((_, c) => rows.map((r) => r[c]));

export const CHART_LIMITS = { categories: 24, series: 8 };

/**
 * Chart data from a grid. Categories run down the first column and series across, with names in
 * a header row when there is one. Data laid out the other way (labels across the top, one row of
 * numbers per series) is turned round. Blank or non-numeric value cells count as 0.
 * @returns {{ ok: true, categories: string[], series: { name: string, values: number[] }[], note?: string }
 *   | { ok: false, error: string }}
 */
export function chartFromGrid(input) {
  let rows = pad(input.filter((r) => r.some((c) => c !== '')));
  if (!rows.length) return { ok: false, error: 'Nothing to paste.' };
  if (rows.flat().every((c) => !isNum(c)))
    return { ok: false, error: 'No numbers found in the pasted cells.' };

  // A header row has text names, or years (2025, 2026) over values that aren't years.
  const yearHeader = (r) =>
    r.length > 1 &&
    r[0].slice(1).every(isYear) &&
    !r.slice(1).every((row) => row.slice(1).every((c) => !c || isYear(c)));
  let header = rows.length > 1 && (mostlyText(rows[0].slice(1)) || yearHeader(rows));
  let labels = mostlyText(rows.slice(header ? 1 : 0).map((r) => r[0]));
  // Labels across the top and numbers below, but no labels down the side: the categories are
  // the columns. Turn it round so they run down, as everywhere else.
  if (header && !labels && rows.length <= rows[0].length) {
    rows = transpose(rows);
    header = rows.length > 1 && mostlyText(rows[0].slice(1));
    labels = mostlyText(rows.slice(header ? 1 : 0).map((r) => r[0]));
  }

  const body = header ? rows.slice(1) : rows;
  const valueCols = labels ? rows[0].length - 1 : rows[0].length;
  if (valueCols < 1) return { ok: false, error: 'Paste at least one column of numbers.' };

  let categories = body.map((r, i) => (labels ? r[0] : '') || `Item ${i + 1}`);
  let series = Array.from({ length: valueCols }, (_, s) => ({
    name: (header ? rows[0][labels ? s + 1 : s] : '') || `Series ${s + 1}`,
    values: body.map((r) => {
      const n = parseNumber(r[labels ? s + 1 : s]);
      return Number.isFinite(n) ? n : 0;
    }),
  }));

  const notes = [];
  if (categories.length > CHART_LIMITS.categories) {
    notes.push(`first ${CHART_LIMITS.categories} rows kept`);
    categories = categories.slice(0, CHART_LIMITS.categories);
    series = series.map((s) => ({ ...s, values: s.values.slice(0, CHART_LIMITS.categories) }));
  }
  if (series.length > CHART_LIMITS.series) {
    notes.push(`first ${CHART_LIMITS.series} series kept`);
    series = series.slice(0, CHART_LIMITS.series);
  }
  categories = categories.map((c) => c.slice(0, 60));
  series = series.map((s) => ({ ...s, name: s.name.slice(0, 60) }));
  return { ok: true, categories, series, ...(notes.length ? { note: notes.join(', ') } : {}) };
}

export const TABLE_LIMITS = { rows: 20, cols: 10 };

/** A grid as table rows: padded to a rectangle, capped at the table limits, cells ≤ 500 chars. */
export function tableFromGrid(input) {
  const rows = pad(input.length ? input : [['']])
    .slice(0, TABLE_LIMITS.rows)
    .map((r) => r.slice(0, TABLE_LIMITS.cols).map((c) => c.slice(0, 500)));
  return rows;
}

/**
 * Paste a grid into existing table rows starting at (row, col), growing the table as needed up
 * to the limits. Returns new rows; the original is untouched.
 */
export function pasteIntoRows(rows, grid, row, col) {
  const height = Math.min(TABLE_LIMITS.rows, Math.max(rows.length, row + grid.length));
  const width = Math.min(
    TABLE_LIMITS.cols,
    Math.max(rows[0]?.length ?? 1, col + Math.max(...grid.map((r) => r.length))),
  );
  const out = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => rows[r]?.[c] ?? ''),
  );
  grid.forEach((cells, r) =>
    cells.forEach((v, c) => {
      if (row + r < height && col + c < width) out[row + r][col + c] = v.slice(0, 500);
    }),
  );
  return out;
}

/** Height of one single-line table row on the canvas, in artboard units (D55). */
export const TABLE_ROW_UNITS = 64;
/** Shortest a row can be: one line at the smallest table text (18 × 2.2em) plus borders, D56. */
export const TABLE_MIN_ROW_UNITS = 44;

/** A new table's box: one row height per row (rows sized to their text), kept above `limit`. */
export function tableBoxAt(bbox, rowCount, limit) {
  return {
    ...bbox,
    h: Math.max(TABLE_ROW_UNITS, Math.min(rowCount * TABLE_ROW_UNITS, limit - bbox.y)),
  };
}

/**
 * The box after the row count changes from `from` to `to` (D56). A box still sized to its rows
 * follows them (adding a row adds a row height, removing one takes it away); a box someone
 * stretched keeps its height and only grows when the rows need more. Never past `limit` (the
 * artboard height minus the safe margin); past that, the text shrinks to fit.
 * @param {{ x: number, y: number, w: number, h: number }} bbox
 * @param {number} from  rows before the edit
 * @param {number} to    rows after the edit
 * @param {number} limit lowest allowed bottom edge
 */
export function tableBoxFor(bbox, from, to, limit) {
  const natural = (n) => n * TABLE_ROW_UNITS;
  const sized = bbox.h <= natural(from) + 1;
  const want = sized ? natural(to) : Math.max(bbox.h, natural(to));
  const h = Math.max(TABLE_ROW_UNITS, Math.min(want, limit - bbox.y));
  return Math.abs(h - bbox.h) < 0.5 ? bbox : { ...bbox, h };
}
