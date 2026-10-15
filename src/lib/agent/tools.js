import { z } from 'zod';
import { elementId as newElementId, slideId as newSlideId } from '../ids.js';
import { findFreeSpot, LAYOUT_DEFS, placeElement, reflowLayout } from '../layout/index.js';
import { applyOp, findElement, OpError } from '../ops/index.js';
import { createSlide } from '../factories.js';
import { CHART_KINDS, SHAPES, TEXT_ROLES } from '../schema/elements.js';
import { LAYOUTS } from '../schema/deck.js';

/*
 * Model-facing tools (D11, D24). Thin wrappers: validate the input (Zod), resolve everything the
 * op needs (fresh ids, slot or free-spot placement), apply the op to the server's throwaway working
 * copy, and only then emit it to the client. Failures come back as results ({ ok: false, error }) so
 * the model can correct itself; nothing invalid is ever streamed.
 *
 * Inputs are deliberately FLAT (no unions, no nullable, no records) so the same JSON Schema works
 * on Sarvam, Gemini and Groq. "START" stands in for "insert first" instead of null.
 *
 * There is no "regenerate deck" tool: edits can only be targeted patches.
 */

const START = 'START';
const LAYOUT_ENUM = z.enum(LAYOUTS.filter((l) => l !== 'blank'));
const LAYOUT_ENUM_ALL = z.enum(LAYOUTS);

const slotHelp = Object.entries(LAYOUT_DEFS)
  .filter(([, d]) => d.slots.length)
  .map(
    ([name, d]) =>
      `${name}: ${d.slots.map((s) => `${s.name}[${s.accepts.join('/')}${s.maxChars ? ` ≤${s.maxChars} chars` : ''}]`).join(', ')}`,
  )
  .join('; ');

const boxFields = {
  slot: z
    .string()
    .optional()
    .describe('Optional layout slot name to place into (see slot list). Omit to auto-place.'),
  x: z
    .number()
    .optional()
    .describe('Optional left edge (0-1920). Give x, y, w and h together, or none.'),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
};
const paragraphsField = z
  .array(z.string().max(400))
  .min(1)
  .max(12)
  .describe('One string per paragraph or bullet point. Keep bullets short (≤ 12 words).');

const explicitBox = (i) =>
  [i.x, i.y, i.w, i.h].every((v) => typeof v === 'number')
    ? { x: i.x, y: i.y, w: i.w, h: i.h }
    : undefined;

const toParagraphs = (list, bullets) =>
  list.map((text) => (bullets ? { text, bullet: true } : { text }));

/**
 * @param {{ deck: object }} ctx  holder for the working copy (replaced on every successful op)
 * @param {{ emit?: (ev: { ops: object[], toolName: string }) => void, defaultSlideId?: string }} [opts]
 */
export function createDeckTools(ctx, { emit = () => {}, defaultSlideId } = {}) {
  /** Apply ops to a copy; commit + emit only if all succeed (all-or-nothing, like dispatch). */
  function commit(toolName, ops) {
    const next = structuredClone(ctx.deck);
    try {
      for (const op of ops) applyOp(next, op);
    } catch (e) {
      if (e instanceof OpError) return { ok: false, error: `${e.code}: ${e.message}` };
      throw e;
    }
    ctx.deck = next;
    emit({ ops, toolName });
    return null;
  }

  const slideOf = (slideId) => ctx.deck.slides[slideId ?? defaultSlideId];
  const noSlide = (slideId) => ({
    ok: false,
    error: `NOT_FOUND: no slide ${slideId ?? defaultSlideId}. Use a slide id from the deck description.`,
  });
  const slideIdField = defaultSlideId
    ? z
        .string()
        .optional()
        .describe(`Slide id. Defaults to the slide you are filling (${defaultSlideId}).`)
    : z.string().describe('Slide id from the deck description, e.g. s_ab3cd');

  /** Shared add-element path: place, mint id, commit. */
  function addElement(toolName, input, partial) {
    const slide = slideOf(input.slideId);
    if (!slide) return noSlide(input.slideId);
    const id = newElementId();
    const { bbox, slot } = placeElement(
      slide,
      { ...partial, bbox: explicitBox(input) },
      input.slot,
      { avoidOverlap: true }, // models guess coordinates; never stack on existing content (D41)
    );
    const element = { ...partial, id, bbox, ...(slot ? { slot } : {}) };
    return (
      commit(toolName, [{ type: 'add_element', slideId: slide.id, element }]) ?? {
        ok: true,
        elementId: id,
        slideId: slide.id,
        bbox,
      }
    );
  }

  const tools = {
    // ---------------------------------------------------------------- read
    get_slide: {
      description:
        'Read the full content of one slide (all text, chart data, table cells). Use it before rewriting content you only see truncated.',
      inputSchema: z.object({ slideId: z.string() }),
      execute: ({ slideId }) => {
        const s = ctx.deck.slides[slideId];
        if (!s) return noSlide(slideId);
        return { ok: true, slide: { ...s, elements: s.elementOrder.map((id) => s.elements[id]) } };
      },
    },

    // ---------------------------------------------------------------- slides
    add_slide: {
      description:
        'Add a slide with a title. It gets a title text box in its layout; add content with add_text / add_chart / add_table / add_image. ' +
        'afterSlideId: insert after this slide; "START" = first; omit = last.',
      inputSchema: z.object({
        title: z.string().max(80).describe('Slide headline, ≤ 60 chars'),
        layout: LAYOUT_ENUM,
        afterSlideId: z.string().optional(),
      }),
      execute: ({ title, layout, afterSlideId }) => {
        const id = newSlideId();
        const slide = createSlide({ id, title, layout });
        const titleId = newElementId();
        const { bbox, slot } = placeElement(slide, { type: 'text', role: 'title' });
        slide.elements[titleId] = {
          id: titleId,
          type: 'text',
          role: 'title',
          bbox,
          slot,
          paragraphs: [{ text: title }],
          style: {},
        };
        slide.elementOrder.push(titleId);
        const anchor = afterSlideId === START ? null : afterSlideId;
        return (
          commit('add_slide', [{ type: 'add_slide', slide, afterSlideId: anchor }]) ?? {
            ok: true,
            slideId: id,
            titleElementId: titleId,
          }
        );
      },
    },
    update_slide: {
      description:
        "Change a slide's title (filmstrip name), speaker notes or background color role (bg | surface | accent).",
      inputSchema: z.object({
        slideId: slideIdField,
        title: z.string().max(80).optional(),
        notes: z.string().max(3000).optional(),
        background: z.string().optional(),
      }),
      execute: ({ slideId, title, notes, background }) => {
        const slide = slideOf(slideId);
        if (!slide) return noSlide(slideId);
        const patch = {};
        if (title !== undefined) patch.title = title;
        if (notes !== undefined) patch.notes = notes;
        if (background !== undefined) patch.background = { color: background };
        return (
          commit('update_slide', [{ type: 'update_slide', slideId: slide.id, patch }]) ?? {
            ok: true,
          }
        );
      },
    },
    delete_slide: {
      description: 'Delete a slide and everything on it.',
      inputSchema: z.object({ slideId: z.string() }),
      execute: ({ slideId }) =>
        commit('delete_slide', [{ type: 'delete_slide', slideId }]) ?? { ok: true },
    },
    duplicate_slide: {
      description: 'Duplicate a slide (placed right after it). Returns the new slide id.',
      inputSchema: z.object({ slideId: z.string() }),
      execute: ({ slideId }) => {
        const src = ctx.deck.slides[slideId];
        if (!src) return noSlide(slideId);
        const newId = newSlideId();
        const idMap = Object.fromEntries(src.elementOrder.map((eid) => [eid, newElementId()]));
        return (
          commit('duplicate_slide', [
            { type: 'duplicate_slide', slideId, newSlideId: newId, idMap },
          ]) ?? { ok: true, slideId: newId }
        );
      },
    },
    reorder_slides: {
      description:
        'Move a slide so it comes right after afterSlideId ("START" = make it the first slide).',
      inputSchema: z.object({ slideId: z.string(), afterSlideId: z.string() }),
      execute: ({ slideId, afterSlideId }) =>
        commit('reorder_slides', [
          {
            type: 'reorder_slides',
            slideId,
            afterSlideId: afterSlideId === START ? null : afterSlideId,
          },
        ]) ?? { ok: true },
    },
    change_layout: {
      description:
        "Switch a slide's layout. Elements still in layout slots reflow; elements the user placed by hand stay put.",
      inputSchema: z.object({ slideId: z.string(), layout: LAYOUT_ENUM_ALL }),
      execute: ({ slideId, layout }) => {
        const slide = slideOf(slideId);
        if (!slide) return noSlide(slideId);
        const placements = reflowLayout(slide, layout);
        return (
          commit('change_layout', [
            { type: 'change_layout', slideId: slide.id, layout, placements },
          ]) ?? { ok: true }
        );
      },
    },

    // ---------------------------------------------------------------- add elements
    add_text: {
      description:
        'Add a text box. role: title (slide headline), subtitle, body (bullets/paragraphs) or caption. ' +
        'Omit slot and coordinates to place it in the layout automatically. Slots per layout: ' +
        slotHelp,
      inputSchema: z.object({
        slideId: slideIdField,
        role: z.enum(TEXT_ROLES),
        paragraphs: paragraphsField,
        bullets: z
          .boolean()
          .optional()
          .describe('Show paragraphs as bullet points (default true for body)'),
        ...boxFields,
      }),
      execute: (i) => {
        const bullets = i.bullets ?? i.role === 'body';
        return addElement('add_text', i, {
          type: 'text',
          role: i.role,
          paragraphs: toParagraphs(i.paragraphs, bullets),
          style: {},
        });
      },
    },
    add_chart: {
      description:
        'Add a real chart. kind: bar | line | area | pie | stacked-bar. Every series needs exactly one number per category. ' +
        'Pie uses the first series only. Use real numbers from the user or the slide; never invent precise financials without saying they are illustrative.',
      inputSchema: z.object({
        slideId: slideIdField,
        kind: z.enum(CHART_KINDS),
        title: z.string().max(80).optional(),
        categories: z.array(z.string().max(40)).min(1).max(12),
        series: z
          .array(z.object({ name: z.string().max(40), values: z.array(z.number()) }))
          .min(1)
          .max(6),
        showLegend: z.boolean().optional(),
        xAxisLabel: z.string().max(40).optional(),
        yAxisLabel: z.string().max(40).optional(),
        ...boxFields,
      }),
      execute: (i) =>
        addElement('add_chart', i, {
          type: 'chart',
          chart: {
            kind: i.kind,
            ...(i.title ? { title: i.title } : {}),
            categories: i.categories,
            series: i.series,
            showLegend: i.showLegend ?? true,
            ...(i.xAxisLabel ? { xAxisLabel: i.xAxisLabel } : {}),
            ...(i.yAxisLabel ? { yAxisLabel: i.yAxisLabel } : {}),
          },
        }),
    },
    add_table: {
      description:
        'Add a table. rows[0] is the header row by default. Every row needs the same number of cells (max 6 columns, 8 rows).',
      inputSchema: z.object({
        slideId: slideIdField,
        rows: z
          .array(z.array(z.string().max(120)).min(1).max(6))
          .min(1)
          .max(8),
        headerRow: z.boolean().optional(),
        ...boxFields,
      }),
      execute: (i) =>
        addElement('add_table', i, { type: 'table', rows: i.rows, headerRow: i.headerRow ?? true }),
    },
    add_image: {
      description:
        'Add an image. Give a short stock-photo search query (e.g. "team planning whiteboard") and alt text; it shows as a placeholder the user can replace.',
      inputSchema: z.object({
        slideId: slideIdField,
        query: z.string().max(100),
        alt: z.string().max(200),
        ...boxFields,
      }),
      execute: (i) =>
        addElement('add_image', i, {
          type: 'image',
          src: '',
          alt: i.alt,
          fit: 'cover',
          query: i.query,
        }),
    },
    add_shape: {
      description:
        'Add a decorative shape: rect | ellipse | line | arrow. fill is a color role (accent, accent2, surface, muted) or hex.',
      inputSchema: z.object({
        slideId: slideIdField,
        shape: z.enum(SHAPES),
        fill: z.string().optional(),
        ...boxFields,
      }),
      execute: (i) =>
        addElement('add_shape', i, { type: 'shape', shape: i.shape, fill: i.fill ?? 'accent' }),
    },

    // ---------------------------------------------------------------- edit elements
    update_element: {
      description:
        'Change one element in place (keeps its id and position). Text: paragraphs, bullets, fontSize (artboard units; body ≈ 34, title ≈ 72), color (role or hex), align. ' +
        'Chart: chartTitle. Table: rows, headerRow. Image: query, alt. Shape: fill. Any element: locked. Only send fields you change.',
      inputSchema: z.object({
        elementId: z.string(),
        paragraphs: paragraphsField.optional(),
        bullets: z.boolean().optional(),
        fontSize: z.number().min(16).max(160).optional(),
        color: z.string().optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
        chartTitle: z.string().max(80).optional(),
        rows: z
          .array(z.array(z.string().max(120)).min(1).max(6))
          .min(1)
          .max(8)
          .optional(),
        headerRow: z.boolean().optional(),
        query: z.string().max(100).optional(),
        alt: z.string().max(200).optional(),
        fill: z.string().optional(),
        locked: z.boolean().optional(),
      }),
      execute: (i) => {
        const r = buildElementPatch(ctx.deck, i);
        if (r.error) return { ok: false, error: r.error };
        return (
          commit('update_element', [
            { type: 'update_element', elementId: i.elementId, patch: r.patch },
          ]) ?? { ok: true }
        );
      },
    },
    update_elements: {
      description:
        'Batch version of update_element for deck-wide changes (e.g. "make it more formal", "shorten every slide"). One call, many elements; all or nothing.',
      inputSchema: z.object({
        updates: z
          .array(
            z.object({
              elementId: z.string(),
              paragraphs: paragraphsField.optional(),
              bullets: z.boolean().optional(),
              fontSize: z.number().min(16).max(160).optional(),
              color: z.string().optional(),
              align: z.enum(['left', 'center', 'right']).optional(),
              chartTitle: z.string().max(80).optional(),
            }),
          )
          .min(1)
          .max(40),
      }),
      execute: ({ updates }) => {
        const ops = [];
        for (const u of updates) {
          const r = buildElementPatch(ctx.deck, u);
          if (r.error) return { ok: false, error: `${u.elementId}: ${r.error}` };
          ops.push({ type: 'update_element', elementId: u.elementId, patch: r.patch });
        }
        return commit('update_elements', ops) ?? { ok: true, updated: ops.length };
      },
    },
    delete_element: {
      description: 'Delete one element.',
      inputSchema: z.object({ elementId: z.string() }),
      execute: ({ elementId }) =>
        commit('delete_element', [{ type: 'delete_element', elementId }]) ?? { ok: true },
    },
    move_element: {
      description:
        'Move an element: to new x/y on its slide, or to another slide (toSlideId). Moving to another slide without x/y finds free space there. copy=true keeps the original.',
      inputSchema: z.object({
        elementId: z.string(),
        toSlideId: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        copy: z.boolean().optional(),
      }),
      execute: ({ elementId, toSlideId, x, y, copy }) => {
        const hit = findElement(ctx.deck, elementId);
        if (!hit) return { ok: false, error: `NOT_FOUND: no element ${elementId}` };
        const target = toSlideId ? ctx.deck.slides[toSlideId] : hit.slide;
        if (!target) return noSlide(toSlideId);
        const { w, h } = hit.el.bbox;
        let bbox;
        if (typeof x === 'number' && typeof y === 'number') bbox = { ...hit.el.bbox, x, y };
        else if (target !== hit.slide)
          bbox = findFreeSpot(target, { w, h }, { x: hit.el.bbox.x, y: hit.el.bbox.y });
        else
          return {
            ok: false,
            error: 'Give x and y to move within the same slide, or a toSlideId.',
          };
        const newId = copy ? newElementId() : undefined;
        const op = {
          type: 'move_element',
          elementId,
          bbox,
          ...(target !== hit.slide ? { toSlideId: target.id } : {}),
          ...(newId ? { newId } : {}),
        };
        return (
          commit('move_element', [op]) ?? {
            ok: true,
            elementId: newId ?? elementId,
            slideId: target.id,
          }
        );
      },
    },
    resize_element: {
      description: 'Resize (and optionally reposition) an element. Units: artboard 1920x1080.',
      inputSchema: z.object({
        elementId: z.string(),
        w: z.number().min(24),
        h: z.number().min(24),
        x: z.number().optional(),
        y: z.number().optional(),
      }),
      execute: ({ elementId, w, h, x, y }) => {
        const hit = findElement(ctx.deck, elementId);
        if (!hit) return { ok: false, error: `NOT_FOUND: no element ${elementId}` };
        const bbox = {
          ...hit.el.bbox,
          w,
          h,
          ...(typeof x === 'number' ? { x } : {}),
          ...(typeof y === 'number' ? { y } : {}),
        };
        return (
          commit('resize_element', [{ type: 'update_element', elementId, patch: { bbox } }]) ?? {
            ok: true,
          }
        );
      },
    },
    reorder_elements: {
      description: 'Change stacking order: forward | backward | front | back.',
      inputSchema: z.object({
        elementId: z.string(),
        direction: z.enum(['forward', 'backward', 'front', 'back']),
      }),
      execute: (i) =>
        commit('reorder_elements', [{ type: 'reorder_elements', ...i }]) ?? { ok: true },
    },

    // ---------------------------------------------------------------- charts
    update_chart_data: {
      description:
        "Replace a chart's categories and/or series (keeps its type and position). One value per category in every series.",
      inputSchema: z.object({
        elementId: z.string(),
        title: z.string().max(80).optional(),
        categories: z.array(z.string().max(40)).min(1).max(12).optional(),
        series: z
          .array(z.object({ name: z.string().max(40), values: z.array(z.number()) }))
          .min(1)
          .max(6)
          .optional(),
      }),
      execute: ({ elementId, title, categories, series }) => {
        const hit = findElement(ctx.deck, elementId);
        if (!hit || hit.el.type !== 'chart')
          return { ok: false, error: `NOT_FOUND: ${elementId} is not a chart` };
        const chart = {
          ...(title !== undefined ? { title } : {}),
          ...(categories ? { categories } : {}),
          ...(series ? { series } : {}),
        };
        return (
          commit('update_chart_data', [
            { type: 'update_element', elementId, patch: { chart } },
          ]) ?? { ok: true }
        );
      },
    },
    change_chart_type: {
      description: 'Switch a chart between bar, line, area, pie and stacked-bar. The data is kept.',
      inputSchema: z.object({ elementId: z.string(), kind: z.enum(CHART_KINDS) }),
      execute: ({ elementId, kind }) => {
        const hit = findElement(ctx.deck, elementId);
        if (!hit || hit.el.type !== 'chart')
          return { ok: false, error: `NOT_FOUND: ${elementId} is not a chart` };
        return (
          commit('change_chart_type', [
            { type: 'update_element', elementId, patch: { chart: { kind } } },
          ]) ?? { ok: true }
        );
      },
    },

    // ---------------------------------------------------------------- control
    finish_turn: {
      description:
        'ALWAYS call this last, exactly once, to end your turn: a one-sentence summary of what you changed and up to 3 short follow-up suggestions the user might click.',
      inputSchema: z.object({
        summary: z.string().max(300),
        // optional: a model that forgets it should still end the turn cleanly
        suggestions: z.array(z.string().max(80)).max(3).optional(),
      }),
      execute: (i) => {
        ctx.finish = { summary: i.summary, suggestions: i.suggestions ?? [] };
        return { ok: true };
      },
    },
  };
  return tools;
}

/** Map flat update fields onto the element's own patch shape; reject fields that don't apply. */
export function buildElementPatch(deck, i) {
  const hit = findElement(deck, i.elementId);
  if (!hit) return { error: `NOT_FOUND: no element ${i.elementId}` };
  const el = hit.el;
  const patch = {};
  const wrong = (field) => ({ error: `${field} does not apply to a ${el.type} element` });

  if (i.paragraphs !== undefined || i.bullets !== undefined) {
    if (el.type !== 'text') return wrong('paragraphs/bullets');
    const bullets = i.bullets ?? el.paragraphs.some((p) => p.bullet);
    const texts = i.paragraphs ?? el.paragraphs.map((p) => p.text);
    patch.paragraphs = toParagraphs(texts, bullets);
  }
  const style = {};
  if (i.fontSize !== undefined) style.fontSize = i.fontSize;
  if (i.color !== undefined) style.color = i.color;
  if (i.align !== undefined) style.align = i.align;
  if (Object.keys(style).length) {
    if (el.type !== 'text') return wrong('fontSize/color/align');
    patch.style = style;
  }
  if (i.chartTitle !== undefined) {
    if (el.type !== 'chart') return wrong('chartTitle');
    patch.chart = { title: i.chartTitle };
  }
  if (i.rows !== undefined || i.headerRow !== undefined) {
    if (el.type !== 'table') return wrong('rows/headerRow');
    if (i.rows !== undefined) patch.rows = i.rows;
    if (i.headerRow !== undefined) patch.headerRow = i.headerRow;
  }
  if (i.query !== undefined || i.alt !== undefined) {
    if (el.type !== 'image') return wrong('query/alt');
    if (i.query !== undefined) patch.query = i.query;
    if (i.alt !== undefined) patch.alt = i.alt;
  }
  if (i.fill !== undefined) {
    if (el.type !== 'shape') return wrong('fill');
    patch.fill = i.fill;
  }
  if (i.locked !== undefined) patch.locked = i.locked;
  if (Object.keys(patch).length === 0)
    return { error: 'Nothing to change: send at least one field.' };
  return { patch };
}

/** Tool names available in each phase (fewer tools = fewer tokens and fewer wrong calls). */
export const TOOLSETS = {
  populate: [
    'add_text',
    'add_chart',
    'add_table',
    'add_image',
    'add_shape',
    'update_slide',
    'finish_turn',
  ],
  agent: null, // all tools
};

export function pickTools(all, phase) {
  const names = TOOLSETS[phase];
  return names ? Object.fromEntries(names.map((n) => [n, all[n]])) : all;
}
