import { z } from 'zod';
import { ElementSchema } from './elements.js';

/*
 * Normalized deck (D3): order arrays + id-keyed maps. Reordering is an array move, lookups are
 * O(1), and ids survive manual edits. `slide.title` is metadata for the filmstrip and AI context,
 * separate from the title text element on the canvas.
 */

export const SLIDE_ID = /^s_[a-z0-9_]{3,40}$/;
export const LAYOUTS = [
  'title',
  'content',
  'two-column',
  'comparison',
  'section',
  'chart-focus',
  'blank',
];

const sameIds = (order, map) =>
  order.length === Object.keys(map).length && order.every((id) => Object.hasOwn(map, id));

export const SlideSchema = z
  .object({
    id: z.string().regex(SLIDE_ID, 'slide ids look like s_ab3cd'),
    title: z.string().max(200),
    layout: z.enum(LAYOUTS),
    background: z
      .object({ color: z.string().min(1).max(32).default('bg'), imageSrc: z.string().optional() })
      .default({ color: 'bg' }),
    notes: z.string().max(5000).default(''),
    elementOrder: z.array(z.string()), // z-order: last is on top
    elements: z.record(z.string(), ElementSchema),
  })
  .refine((s) => sameIds(s.elementOrder, s.elements), {
    message: 'elementOrder must list exactly the ids in elements',
  })
  .refine((s) => s.elementOrder.every((id) => s.elements[id]?.id === id), {
    message: 'element map keys must match element ids',
  });

export const DeckSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().max(200),
    aspectRatio: z.literal('16:9'),
    theme: z.string().default('paper'),
    slideOrder: z.array(z.string()),
    slides: z.record(z.string(), SlideSchema),
    updatedAt: z.number().optional(),
  })
  .refine((d) => sameIds(d.slideOrder, d.slides), {
    message: 'slideOrder must list exactly the ids in slides',
  });

/**
 * @typedef {'title'|'content'|'two-column'|'comparison'|'section'|'chart-focus'|'blank'} Layout
 * @typedef {{ id: string, title: string, layout: Layout, background: { color: string, imageSrc?: string },
 *   notes: string, elementOrder: string[], elements: Record<string, import('./elements.js').Element> }} Slide
 * @typedef {{ id: string, title: string, aspectRatio: '16:9', theme: string, slideOrder: string[],
 *   slides: Record<string, Slide>, updatedAt?: number }} Deck
 */
