import { z } from 'zod';
import {
  createDeckTools,
  describeElement,
  pickTools,
  POPULATE_PROMPT,
  populateRequest,
  PROMPT_VERSION,
} from '../src/lib/agent/index.js';
import { DeckSchema } from '../src/lib/schema/index.js';
import { readRequest } from './_lib/guard.js';
import { runTurn } from './_lib/runTurn.js';
import { sseResponse } from './_lib/sse.js';

// Phase 2 of generation (D12): fill ONE slide from its brief. The client runs 2-3 of these in
// parallel; each is short, so serverless timeouts and per-call token caps are never a problem,
// and a failed slide can be retried alone.

const Body = z.object({
  deck: DeckSchema,
  slideId: z.string(),
  brief: z.object({
    slideId: z.string(),
    title: z.string(),
    layout: z.string(),
    intent: z.string().optional().default(''),
    keyPoints: z.array(z.string()).optional().default([]),
    visual: z.string().optional().default('none'),
  }),
  userPrompt: z.string().max(4000),
  index: z.number().int(),
  total: z.number().int(),
  turnId: z.string().max(40),
});

export async function POST(request) {
  const req = await readRequest(request, Body);
  if (req.response) return req.response;
  const { deck, slideId, brief, userPrompt, index, total, turnId } = req.body;

  return sseResponse(request, async (send, signal) => {
    const ctx = { deck };
    const applied = { count: 0 };
    const all = createDeckTools(ctx, {
      defaultSlideId: slideId,
      emit: ({ ops, toolName }) => {
        applied.count += ops.length;
        send('op', { ops, toolName, turnId, slideId });
      },
    });
    const slide = deck.slides[slideId];
    const existing = slide
      ? slide.elementOrder.map((id) => `  ${describeElement(slide.elements[id])}`).join('\n')
      : '';
    const prompt = `${populateRequest(brief, { deckTitle: deck.title, userPrompt, index, total })}\n\nAlready on the slide:\n${existing || '  (nothing)'}`;
    const run = await runTurn({
      send,
      signal,
      tools: pickTools(all, 'populate'),
      applied,
      phase: 'populating',
      instructions: POPULATE_PROMPT,
      prompt,
      maxSteps: 8,
      maxOutputTokens: 2500,
      isComplete: () => applied.count > 0, // an empty slide is a failure, not a success
    });
    send('done', {
      slideId,
      summary: ctx.finish?.summary,
      provider: run.provider,
      model: run.model,
      usage: run.usage,
      promptVersion: PROMPT_VERSION,
    });
  });
}
