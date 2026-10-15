import { legendAvailable } from '../chart.js';
import { ARTBOARD_W } from '../constants.js';
import { resolveColor, seriesColor, textStyleFor } from '../theme/index.js';

/*
 * PowerPoint export (D21, D44), pure: deck -> pptxgenjs calls. Runs in the browser (download)
 * and in Node (tests, QA renders). Everything that needs the DOM (text fit measured with the
 * export fonts, images pre-cropped to their boxes) is computed by the caller and passed in.
 *
 * Geometry: the artboard is 1920 x 1080 units = 13.333 x 7.5 in (PowerPoint "wide"), so
 * 144 units = 1 inch and 2 units = 1 point. Everything below converts with those two rules, so
 * positions and sizes land exactly where they are on the canvas.
 */

export const UNITS_PER_INCH = ARTBOARD_W / 13.333333;
export const inch = (u) => Math.round((u / UNITS_PER_INCH) * 10000) / 10000;
export const pt = (u) => Math.round((u / 2) * 10) / 10;

/**
 * Fonts written into the file. Web fonts (Instrument Serif, Geist) are not installed on most
 * machines and PowerPoint would substitute something with different widths, so the deck names
 * fonts that ship with Office on Windows and macOS instead. Text fit is re-measured with these
 * (see services/pptxExport.js), so boxes still don't overflow.
 */
export const EXPORT_FONTS = { heading: 'Cambria', body: 'Arial', mono: 'Courier New' };
/** CSS stacks used to measure text with the export fonts (metric-compatible fallbacks first). */
export const EXPORT_FONT_CSS = {
  heading: "Cambria, Caladea, 'Times New Roman', serif",
  body: "Arial, 'Liberation Sans', Helvetica, sans-serif",
  mono: "'Courier New', 'Liberation Mono', monospace",
};

/** CSS color -> { color: 'RRGGBB', transparency? } (pptxgenjs: no '#', never 8 digits). */
export function pptxColor(css) {
  if (!css || css === 'transparent') return { color: 'FFFFFF', transparency: 100 };
  let h = css.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  const out = { color: h.slice(0, 6).toUpperCase() };
  if (h.length === 8) out.transparency = Math.round((1 - parseInt(h.slice(6), 16) / 255) * 100);
  return out;
}
const hex = (css) => pptxColor(css).color;

const box = (b) => ({
  x: inch(b.x),
  y: inch(b.y),
  w: inch(b.w),
  h: inch(b.h),
  ...(b.rotation ? { rotate: b.rotation } : {}),
});

const fontRole = (theme, family) =>
  family === theme.fonts.heading ? 'heading' : family === theme.fonts.mono ? 'mono' : 'body';

/** Text element -> addText(runs, options). `fittedSize` (units) comes from the export-font measure. */
export function textCall(el, theme, fittedSize) {
  const s = textStyleFor(el, theme);
  const size = Math.min(fittedSize ?? s.fontSize, s.fontSize);
  const color = pptxColor(s.color);
  const runs = el.paragraphs.map((p, i) => ({
    text: p.text,
    options: {
      breakLine: i < el.paragraphs.length - 1,
      ...(p.bullet ? { bullet: { indent: pt(size * 1.1) } } : {}),
      ...(p.level ? { indentLevel: p.level } : {}),
      paraSpaceAfter: i < el.paragraphs.length - 1 ? pt(size * 0.35) : 0,
    },
  }));
  return {
    kind: 'text',
    runs,
    options: {
      ...box(el.bbox),
      isTextBox: true,
      objectName: el.id,
      fontFace: EXPORT_FONTS[fontRole(theme, s.fontFamily)],
      fontSize: pt(size),
      bold: s.fontWeight >= 600,
      color: color.color,
      ...(color.transparency ? { transparency: color.transparency } : {}),
      align: s.textAlign,
      valign: 'top',
      margin: 0, // the canvas draws text flush with its box
      lineSpacingMultiple: s.lineHeight,
      fit: 'shrink', // PowerPoint backstop if a substitute font still runs long
    },
  };
}

const CHART_TYPE = {
  bar: 'bar',
  'stacked-bar': 'bar',
  line: 'line',
  area: 'area',
  pie: 'doughnut',
};

/** Chart element -> addChart(type, data, options): a native, editable PowerPoint chart. */
export function chartCall(el, theme) {
  const c = el.chart;
  const ink = hex(resolveColor('text', theme));
  const muted = hex(resolveColor('muted', theme));
  const line = hex(resolveColor('border', theme));
  const pie = c.kind === 'pie';
  const series = pie ? c.series.slice(0, 1) : c.series;
  const data = series.map((s) => ({ name: s.name, labels: c.categories, values: s.values }));
  const colors = pie
    ? c.categories.map((_, i) => hex(theme.chart[i % theme.chart.length]))
    : series.map((s, i) => hex(seriesColor(s, i, theme)));
  const legend = c.showLegend !== false && legendAvailable(c);
  const font = EXPORT_FONTS.body;
  const options = {
    ...box(el.bbox),
    objectName: el.id,
    chartColors: colors,
    showTitle: Boolean(c.title),
    ...(c.title
      ? { title: c.title, titleFontFace: font, titleFontSize: 15, titleColor: ink, titleBold: true }
      : {}),
    showLegend: legend,
    ...(legend
      ? { legendPos: 't', legendFontFace: font, legendFontSize: 11, legendColor: ink }
      : {}),
    showValue: Boolean(c.showDataLabels),
    dataLabelFontFace: font,
    dataLabelFontSize: 11,
    dataLabelColor: ink,
  };
  if (pie) {
    Object.assign(options, {
      holeSize: 55, // the canvas draws a donut with a 55% hole
      showPercent: false,
      dataBorder: { pt: 2, color: hex(resolveColor('bg', theme)) },
    });
  } else {
    Object.assign(options, {
      catAxisLabelFontFace: font,
      catAxisLabelFontSize: 11,
      catAxisLabelColor: muted,
      valAxisLabelFontFace: font,
      valAxisLabelFontSize: 11,
      valAxisLabelColor: muted,
      catAxisLineShow: true,
      catAxisLineColor: line,
      valAxisLineShow: false,
      valGridLine: { color: line, size: 1 },
      catGridLine: { style: 'none' },
      ...(c.xAxisLabel
        ? {
            showCatAxisTitle: true,
            catAxisTitle: c.xAxisLabel,
            catAxisTitleFontSize: 11,
            catAxisTitleColor: muted,
          }
        : {}),
      ...(c.yAxisLabel
        ? {
            showValAxisTitle: true,
            valAxisTitle: c.yAxisLabel,
            valAxisTitleFontSize: 11,
            valAxisTitleColor: muted,
          }
        : {}),
    });
    if (c.kind === 'bar' || c.kind === 'stacked-bar') {
      Object.assign(options, {
        barDir: 'col',
        barGapWidthPct: 60,
        ...(c.kind === 'stacked-bar' ? { barGrouping: 'stacked', dataLabelPosition: 'ctr' } : {}),
      });
      if (c.showDataLabels && c.kind === 'bar') options.dataLabelPosition = 'outEnd';
    } else {
      Object.assign(options, {
        lineSize: 2.5,
        lineSmooth: true, // the canvas draws monotone curves
        lineDataSymbol: c.kind === 'line' ? 'circle' : 'none',
        lineDataSymbolSize: 8,
      });
    }
  }
  return { kind: 'chart', type: CHART_TYPE[c.kind], data, options };
}

/** Table element -> addTable(rows, options): native table, same fills, borders and padding. */
export function tableCall(el, theme) {
  const c = (role) => hex(resolveColor(role, theme));
  const cols = el.rows[0]?.length ?? 1;
  const border = { type: 'solid', pt: 1, color: c('border') };
  const rows = el.rows.map((row, r) => {
    const header = el.headerRow && r === 0;
    const fill = header ? c('accent') : r % 2 ? c('surface') : c('bg');
    return row.map((text) => ({
      text,
      options: {
        fill: { color: fill },
        color: header ? c('onAccent') : c('text'),
        bold: header,
        border: [border, border, border, border],
      },
    }));
  });
  return {
    kind: 'table',
    rows,
    options: {
      ...box(el.bbox),
      objectName: el.id,
      colW: Array(cols).fill(inch(el.bbox.w) / cols),
      rowH: inch(el.bbox.h) / el.rows.length,
      fontFace: EXPORT_FONTS.body,
      fontSize: 14, // 28 units on the canvas
      valign: 'middle',
      margin: [7, 10, 7, 10], // points: the canvas pads cells 14 x 20 units
    },
  };
}

/**
 * Image element -> addImage. `prepared` is a data URL already cropped (cover) or letterboxed
 * (contain) to the box with its rounded corners, so the file shows exactly the canvas framing.
 * Without one (no src, or a remote image that couldn't be fetched), a labeled placeholder.
 */
export function imageCalls(el, theme, prepared) {
  if (prepared) {
    return [
      {
        kind: 'image',
        options: {
          ...box(el.bbox),
          objectName: el.id,
          data: prepared.replace(/^data:/, ''),
          altText: el.alt || el.query || '',
        },
      },
    ];
  }
  return [
    {
      kind: 'shape',
      type: 'roundRect',
      options: {
        ...box(el.bbox),
        objectName: el.id,
        rectRadius: 0.08,
        fill: { color: hex(resolveColor('surface', theme)) },
        line: { color: hex(resolveColor('border', theme)), width: 1.5, dashType: 'dash' },
      },
    },
    {
      kind: 'text',
      runs: [{ text: el.query || el.alt || 'Image', options: {} }],
      options: {
        ...box(el.bbox),
        isTextBox: true,
        fontFace: EXPORT_FONTS.body,
        fontSize: 13,
        color: hex(resolveColor('muted', theme)),
        align: 'center',
        valign: 'middle',
      },
    },
  ];
}

/** Shape element -> addShape. */
export function shapeCall(el, theme) {
  const fill = pptxColor(resolveColor(el.fill, theme, 'accent'));
  const stroke = el.stroke ? hex(resolveColor(el.stroke, theme)) : null;
  if (el.shape === 'line' || el.shape === 'arrow') {
    const { x, y, w, h } = el.bbox;
    return {
      kind: 'shape',
      type: 'line',
      options: {
        ...box({ x, y: y + h / 2, w, h: 0 }),
        objectName: el.id,
        line: {
          color: stroke ?? fill.color,
          width: 3,
          ...(el.shape === 'arrow' ? { endArrowType: 'triangle' } : {}),
        },
      },
    };
  }
  return {
    kind: 'shape',
    type: el.shape === 'ellipse' ? 'ellipse' : 'roundRect',
    options: {
      ...box(el.bbox),
      objectName: el.id,
      ...(el.shape === 'ellipse' ? {} : { rectRadius: inch(16) }),
      fill: {
        color: fill.color,
        ...(fill.transparency ? { transparency: fill.transparency } : {}),
      },
      line: stroke ? { color: stroke, width: 2 } : { type: 'none' },
    },
  };
}

/**
 * The whole deck as a list of slides with their pptxgenjs calls, in z-order.
 * @param {object} deck
 * @param {object} theme  the deck's own theme (export never uses the dark display variant)
 * @param {{ fitted?: Record<string, number>, images?: Record<string, string|null> }} [prepared]
 */
export function buildPptxModel(deck, theme, { fitted = {}, images = {} } = {}) {
  return deck.slideOrder.map((sid) => {
    const slide = deck.slides[sid];
    const calls = slide.elementOrder.flatMap((id) => {
      const el = slide.elements[id];
      switch (el.type) {
        case 'text':
          return [textCall(el, theme, fitted[id])];
        case 'chart':
          return [chartCall(el, theme)];
        case 'table':
          return [tableCall(el, theme)];
        case 'image':
          return imageCalls(el, theme, images[id]);
        case 'shape':
          return [shapeCall(el, theme)];
        default:
          return [];
      }
    });
    return {
      id: sid,
      title: slide.title,
      background: hex(resolveColor(slide.background?.color, theme, 'bg')),
      notes: slide.notes || '',
      calls,
    };
  });
}

/**
 * Write the model with a pptxgenjs instance. `PptxGenJS` is passed in (dynamic import in the
 * browser, require in Node), so lib/ doesn't depend on it at load time.
 */
export function writePptx(PptxGenJS, deck, model) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in = the 1920 x 1080 artboard
  pres.title = deck.title;
  pres.theme = { headFontFace: EXPORT_FONTS.heading, bodyFontFace: EXPORT_FONTS.body };
  for (const s of model) {
    const slide = pres.addSlide();
    slide.background = { color: s.background };
    for (const call of s.calls) {
      // pptxgenjs mutates option objects (converts to EMU): always hand it fresh copies.
      const options = structuredClone(call.options);
      if (call.kind === 'text') slide.addText(structuredClone(call.runs), options);
      else if (call.kind === 'chart')
        slide.addChart(call.type, structuredClone(call.data), options);
      else if (call.kind === 'table') slide.addTable(structuredClone(call.rows), options);
      else if (call.kind === 'image') slide.addImage(options);
      else if (call.kind === 'shape') slide.addShape(call.type, options);
    }
    if (s.notes) slide.addNotes(s.notes);
  }
  return pres;
}
