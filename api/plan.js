import { z } from 'zod';
import { createPlanTool, PLAN_PROMPT, PROMPT_VERSION } from '../src/lib/agent/index.js';
import { DeckSchema } from '../src/lib/schema/index.js';
import { readRequest } from './_lib/guard.js';
import { runTurn } from './_lib/runTurn.js';
import { AgentError, sseResponse } from './_lib/sse.js';

// Phase 1 of generation (D12): one forced plan_deck call -> titled skeleton slides + per-slide briefs.

const Body = z.object({
  deck: DeckSchema,
  prompt: z.string().min(1).max(4000),
  slideCount: z.number().int().min(1).max(12).optional(),
  turnId: z.string().max(40),
});

export async function POST(request) {
  const req = await readRequest(request, Body);
  if (req.response) return req.response;
  const { deck, prompt, slideCount, turnId } = req.body;

  return sseResponse(request, async (send, signal) => {
    const ctx = { deck };
    const applied = { count: 0 };
    const tools = createPlanTool(ctx, {
      emit: ({ ops, toolName }) => {
        applied.count += ops.length;
        send('op', { ops, toolName, turnId });
      },
    });
    const ask = `${prompt}\n\nNumber of slides: ${slideCount ?? 'your choice (5-7)'}.`;
    const run = await runTurn({
      send,
      signal,
      tools,
      applied,
      phase: 'planning',
      instructions: PLAN_PROMPT,
      prompt: ask,
      toolChoice: { type: 'tool', toolName: 'plan_deck' },
      maxSteps: 1,
      // generous: Sarvam's reasoning tokens count against this, and a truncated call arrives
      // as an empty plan_deck input
      maxOutputTokens: 4000,
      isComplete: () => Boolean(ctx.plan),
    });
    if (!ctx.plan)
      throw new AgentError(
        'NO_PLAN',
        'The model did not return a plan. Try rephrasing the request.',
      );
    send('done', {
      plan: ctx.plan,
      provider: run.provider,
      model: run.model,
      usage: run.usage,
      promptVersion: PROMPT_VERSION,
    });
  });
}
