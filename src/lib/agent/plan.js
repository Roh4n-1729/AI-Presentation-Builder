import { z } from 'zod';
import { elementId as newElementId, slideId as newSlideId } from '../ids.js';
import { placeElement } from '../layout/index.js';
import { createSlide } from '../factories.js';
import { applyOp, OpError } from '../ops/index.js';
import { LAYOUTS } from '../schema/deck.js';

/*
 * Phase 1 of generation (D12): the model is forced to call plan_deck once. We turn the plan into
 * skeleton slides (title only) immediately, so the filmstrip fills before any content exists, and
 * keep each slide's brief (intent, key points, visual) for the per-slide populate calls.
 */

export const PlanSchema = z.object({
  title: z.string().max(80).describe('Deck title, ≤ 60 chars'),
  slides: z
    .array(
      z.object({
        title: z.string().max(80).describe('Slide headline that states the point, ≤ 60 chars'),
        layout: z.enum(LAYOUTS.filter((l) => l !== 'blank')),
        intent: z
          .string()
          .max(300)
          .describe('What this slide must make the audience understand, one sentence'),
        keyPoints: z
          .array(z.string().max(160))
          .max(5)
          .describe('The facts, numbers or claims this slide should carry'),
        visual: z.enum(['none', 'chart', 'table', 'image']).describe('The main visual, if any'),
      }),
    )
    .min(1)
    .max(12),
  // Follow-up edits shown as chips once the deck is built (D70). Lenient limits: one long or
  // extra suggestion must not fail the whole plan; they are clipped in cleanSuggestions.
  suggestions: z
    .array(z.string().max(200))
    .max(6)
    .optional()
    .describe(
      '3 short follow-up edits the user might ask for once this deck is built, specific to its slides (e.g. "Add a pricing table to slide 4"), each ≤ 60 chars',
    ),
});

/** At most 3 distinct, non-empty suggestions of at most 80 characters. */
export function cleanSuggestions(list) {
  const out = [];
  for (const raw of list ?? []) {
    const t = String(raw).replace(/\s+/g, ' ').trim();
    if (!t || t.length > 80 || out.some((o) => o.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
    if (out.length === 3) break;
  }
  return out;
}

/** @returns {{ ops: object[], briefs: object[] }} */
export function planToOps(plan) {
  const ops = [{ type: 'update_deck', patch: { title: plan.title } }];
  const briefs = [];
  let after = undefined; // first add goes last (deck may be empty), then chain anchors
  for (const p of plan.slides) {
    const id = newSlideId();
    const slide = createSlide({ id, title: p.title, layout: p.layout });
    const titleId = newElementId();
    const { bbox, slot } = placeElement(slide, { type: 'text', role: 'title' });
    slide.elements[titleId] = {
      id: titleId,
      type: 'text',
      role: 'title',
      bbox,
      slot,
      paragraphs: [{ text: p.title }],
      style: {},
    };
    slide.elementOrder.push(titleId);
    ops.push({ type: 'add_slide', slide, ...(after ? { afterSlideId: after } : {}) });
    after = id;
    briefs.push({ slideId: id, titleElementId: titleId, ...p });
  }
  return { ops, briefs };
}

/** plan_deck tool for /api/plan: commits the skeleton to the working copy and emits it as one batch. */
export function createPlanTool(ctx, { emit = () => {} } = {}) {
  return {
    plan_deck: {
      description:
        'Plan the whole deck in one call: a deck title and one entry per slide, in presentation order. ' +
        'Start with a title slide; end with a summary or next-steps slide. Choose layouts that fit the visual: ' +
        'chart-focus for a chart, two-column or comparison for a table next to text, section for a divider.',
      inputSchema: PlanSchema,
      execute: (plan) => {
        const { ops, briefs } = planToOps(plan);
        const next = structuredClone(ctx.deck);
        try {
          for (const op of ops) applyOp(next, op);
        } catch (e) {
          if (e instanceof OpError) return { ok: false, error: `${e.code}: ${e.message}` };
          throw e;
        }
        ctx.deck = next;
        ctx.plan = { title: plan.title, briefs, suggestions: cleanSuggestions(plan.suggestions) };
        emit({ ops, toolName: 'plan_deck' });
        return { ok: true, slides: briefs.map((b) => ({ slideId: b.slideId, title: b.title })) };
      },
    },
  };
}
