import { z } from 'zod';
import {
  createDeckTools,
  EDIT_PROMPT,
  PROMPT_VERSION,
  serializeDeck,
} from '../src/lib/agent/index.js';
import { DeckSchema } from '../src/lib/schema/index.js';
import { readRequest } from './_lib/guard.js';
import { runTurn } from './_lib/runTurn.js';
import { sseResponse } from './_lib/sse.js';

// Edits after generation (D11, D13): the full tool set, patch-only. The deck description is built
// fresh from the client's store on every turn, so the model always sees manual changes.

const Body = z.object({
  deck: DeckSchema,
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(20)
    .default([]),
  activeSlideId: z.string().nullable().optional(),
  selection: z.array(z.string()).max(50).default([]),
  turnId: z.string().max(40),
});

export async function POST(request) {
  const req = await readRequest(request, Body);
  if (req.response) return req.response;
  const { deck, message, history, activeSlideId, selection, turnId } = req.body;

  return sseResponse(request, async (send, signal) => {
    const ctx = { deck };
    const applied = { count: 0 };
    const tools = createDeckTools(ctx, {
      emit: ({ ops, toolName }) => {
        applied.count += ops.length;
        send('op', { ops, toolName, turnId });
      },
    });
    const context = serializeDeck(deck, { activeSlideId, selection });
    const messages = [
      ...history.slice(-8),
      { role: 'user', content: `Current deck:\n${context}\n\nRequest: ${message}` },
    ];
    const run = await runTurn({
      send,
      signal,
      tools,
      applied,
      phase: 'editing',
      instructions: EDIT_PROMPT,
      messages,
      maxSteps: 12,
      maxOutputTokens: 3000,
    });
    send('done', {
      summary: ctx.finish?.summary,
      suggestions: ctx.finish?.suggestions ?? [],
      provider: run.provider,
      model: run.model,
      usage: run.usage,
      promptVersion: PROMPT_VERSION,
    });
  });
}
