import { z } from 'zod';

/*
 * Element schema (D4). Every piece of content is an element with a stable id, a bounding box in
 * artboard units (1920×1080) and a type-specific payload. Colors are theme roles or hex (D17).
 * These schemas validate ops and stored decks; the model-facing tool schemas are separate and flat.
 */

export const ELEMENT_ID = /^el_[a-z0-9_]{3,40}$/;

const id = z.string().regex(ELEMENT_ID, 'element ids look like el_ab3cd');
const color = z.string().min(1).max(32); // role ('accent') or hex ('#4250d5'); resolveColor falls back

export const BBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().optional(),
});

const base = {
  id,
  bbox: BBoxSchema,
  locked: z.boolean().optional(),
  slot: z.string().max(40).optional(), // set by the layout engine; cleared when hand-placed (D9)
  name: z.string().max(80).optional(),
};

export const TEXT_ROLES = ['title', 'subtitle', 'body', 'caption'];

export const ParagraphSchema = z.object({
  text: z.string().max(2000),
  bullet: z.boolean().optional(),
  level: z.number().int().min(0).max(3).optional(),
});

export const TextElementSchema = z.object({
  ...base,
  type: z.literal('text'),
  role: z.enum(TEXT_ROLES),
  paragraphs: z.array(ParagraphSchema).min(1).max(40),
  // Every style field is optional: the renderer fills gaps from the theme by role.
  style: z
    .object({
      fontSize: z.number().min(8).max(400).optional(),
      color: color.optional(),
      fontWeight: z
        .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
        .optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
      font: z.enum(['heading', 'body']).optional(),
    })
    .default({}),
});

export const ImageElementSchema = z.object({
  ...base,
  type: z.literal('image'),
  src: z.string().max(15_000_000), // URL, data: URL, or '' (placeholder showing `query`)
  alt: z.string().max(300).default(''),
  fit: z.enum(['cover', 'contain']).default('cover'),
  query: z.string().max(200).optional(), // stock-photo search query supplied by the AI
});

export const CHART_KINDS = ['bar', 'line', 'area', 'pie', 'stacked-bar'];

export const ChartSpecSchema = z
  .object({
    kind: z.enum(CHART_KINDS),
    title: z.string().max(120).optional(),
    categories: z.array(z.string().max(60)).min(1).max(24),
    series: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          values: z.array(z.number()),
          color: color.optional(),
        }),
      )
      .min(1)
      .max(8),
    showLegend: z.boolean().default(true),
    showDataLabels: z.boolean().optional(),
    xAxisLabel: z.string().max(60).optional(),
    yAxisLabel: z.string().max(60).optional(),
  })
  // Data and type are separate (D4), so switching bar -> line keeps the data. Every series must
  // have one value per category; the error text is written for the model to self-correct.
  .refine((c) => c.series.every((s) => s.values.length === c.categories.length), {
    message: 'each series needs exactly one value per category',
    path: ['series'],
  });

export const ChartElementSchema = z.object({
  ...base,
  type: z.literal('chart'),
  chart: ChartSpecSchema,
});

export const TableElementSchema = z.object({
  ...base,
  type: z.literal('table'),
  rows: z
    .array(z.array(z.string().max(500)).min(1).max(10))
    .min(1)
    .max(20)
    .refine((rows) => rows.every((r) => r.length === rows[0].length), {
      message: 'every table row needs the same number of cells',
    }),
  headerRow: z.boolean().default(true),
});

export const SHAPES = ['rect', 'ellipse', 'line', 'arrow'];

export const ShapeElementSchema = z.object({
  ...base,
  type: z.literal('shape'),
  shape: z.enum(SHAPES),
  fill: color.default('accent'),
  stroke: color.optional(),
});

export const ELEMENT_TYPES = ['text', 'image', 'chart', 'table', 'shape'];

export const ElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  ChartElementSchema,
  TableElementSchema,
  ShapeElementSchema,
]);

/**
 * @typedef {{ x: number, y: number, w: number, h: number, rotation?: number }} BBox
 * @typedef {{ text: string, bullet?: boolean, level?: number }} Paragraph
 * @typedef {{ id: string, bbox: BBox, locked?: boolean, slot?: string, name?: string }} ElementBase
 * @typedef {ElementBase & { type: 'text', role: 'title'|'subtitle'|'body'|'caption', paragraphs: Paragraph[],
 *   style: { fontSize?: number, color?: string, fontWeight?: 400|500|600|700, align?: 'left'|'center'|'right', font?: 'heading'|'body' } }} TextElement
 * @typedef {ElementBase & { type: 'image', src: string, alt: string, fit: 'cover'|'contain', query?: string }} ImageElement
 * @typedef {{ kind: 'bar'|'line'|'area'|'pie'|'stacked-bar', title?: string, categories: string[],
 *   series: { name: string, values: number[], color?: string }[], showLegend: boolean,
 *   showDataLabels?: boolean, xAxisLabel?: string, yAxisLabel?: string }} ChartSpec
 * @typedef {ElementBase & { type: 'chart', chart: ChartSpec }} ChartElement
 * @typedef {ElementBase & { type: 'table', rows: string[][], headerRow: boolean }} TableElement
 * @typedef {ElementBase & { type: 'shape', shape: 'rect'|'ellipse'|'line'|'arrow', fill: string, stroke?: string }} ShapeElement
 * @typedef {TextElement | ImageElement | ChartElement | TableElement | ShapeElement} Element
 */
