import { z } from 'zod';
import { BBoxSchema, ELEMENT_ID, ElementSchema } from './elements.js';
import { LAYOUTS, SLIDE_ID, SlideSchema } from './deck.js';

/*
 * The op language (D1, D24). Every deck change is one of these. Ops are id-anchored (positions
 * are `afterSlideId`, never indices) and fully resolved (concrete ids, boxes and slots), so the
 * same op lands the same way on the server's working copy and on the client store.
 */

const slideId = z.string().regex(SLIDE_ID);
const elementId = z.string().regex(ELEMENT_ID);
/** null = first position; omitted = last; an id that no longer exists also means last. */
const afterSlideId = slideId.nullable().optional();

export const OpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('update_deck'),
    patch: z.object({ title: z.string().max(200).optional(), theme: z.string().optional() }),
  }),
  z.object({ type: z.literal('add_slide'), slide: SlideSchema, afterSlideId }),
  z.object({
    type: z.literal('update_slide'),
    slideId,
    patch: z.object({
      title: z.string().max(200).optional(),
      notes: z.string().max(5000).optional(),
      background: z
        .object({ color: z.string().min(1).max(32).optional(), imageSrc: z.string().optional() })
        .optional(),
    }),
  }),
  z.object({ type: z.literal('delete_slide'), slideId }),
  z.object({
    type: z.literal('duplicate_slide'),
    slideId,
    newSlideId: slideId,
    /** old element id -> new element id; ids missing here are derived deterministically */
    idMap: z.record(elementId, elementId).optional(),
    afterSlideId, // omitted = right after the source slide
  }),
  z.object({ type: z.literal('reorder_slides'), slideId, afterSlideId: slideId.nullable() }),
  z.object({
    type: z.literal('change_layout'),
    slideId,
    layout: z.enum(LAYOUTS),
    /** new boxes for elements that were in a slot, computed by the caller (layout/reflowLayout) */
    placements: z
      .record(elementId, z.object({ bbox: BBoxSchema, slot: z.string().max(40).nullable() }))
      .default({}),
  }),
  z.object({ type: z.literal('add_element'), slideId, element: ElementSchema }),
  z.object({
    type: z.literal('update_element'),
    elementId,
    /** shallow merge; plain-object fields (bbox, style, chart) merge one level deep */
    patch: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal('delete_element'), elementId }),
  z.object({
    type: z.literal('move_element'),
    elementId,
    toSlideId: slideId.optional(), // omitted = same slide
    bbox: BBoxSchema,
    newId: elementId.optional(), // present = copy instead of move
  }),
  z.object({
    type: z.literal('reorder_elements'),
    elementId,
    direction: z.enum(['forward', 'backward', 'front', 'back']),
  }),
]);

export const OP_TYPES = OpSchema.options.map((o) => o.shape.type.value);

/** @typedef {import('zod').infer<typeof OpSchema>} DeckOp */
