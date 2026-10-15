/**
 * LLM smoke test (D14 / D27): checks each provider key and whether the model can do what the agent
 * needs, before we build on it. Run from the repo root:
 *
 *   node --env-file=.env scripts/llm-smoke.js            # every provider that has a key
 *   node --env-file=.env scripts/llm-smoke.js sarvam     # one provider
 *
 * Per provider, two calls:
 *   1. FORCED TOOL CALL: toolChoice = plan_deck (phase 1 of generation). Checks auth, the model id,
 *      that forced tool choice works, and that the arguments validate against our Zod schema.
 *   2. STREAMED TOOL LOOP: streamText with two executing tools (add_text, finish_turn), stopping at
 *      finish_turn. Checks multi-step tool use, that parts stream (not one burst at the end), and
 *      that the model ends its turn the way /api/agent will require.
 * Prints latency, token usage and a verdict. Keys are never printed (only a masked tail).
 * Each run spends a few Sarvam credits.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import {
  APICallError,
  generateText,
  hasToolCall,
  RetryError,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import { createSarvam } from 'sarvam-ai-sdk';
import { z } from 'zod';

const PROVIDERS = {
  sarvam: {
    envKey: 'SARVAM_API_KEY',
    modelId: process.env.SARVAM_MODEL || 'sarvam-105b',
    // Reasoning tokens count against max_tokens (D14): keep it low for tool calls.
    make: (key, id) =>
      createSarvam({ apiKey: key })(id, {
        reasoning_effort: process.env.SARVAM_REASONING || 'low',
      }),
    providerOptions: {},
  },
  gemini: {
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    modelId: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    make: (key, id) => createGoogleGenerativeAI({ apiKey: key })(id),
    providerOptions: {},
  },
  groq: {
    envKey: 'GROQ_API_KEY',
    modelId: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    make: (key, id) => createGroq({ apiKey: key })(id),
    providerOptions: { groq: { reasoningEffort: 'low' } },
  },
};

// Flat schemas (no unions), like the real tools will be, so every provider accepts them.
const planDeck = tool({
  description:
    'Plan a slide deck. Call exactly once with the deck title and one entry per slide, in order.',
  inputSchema: z.object({
    title: z.string().describe('Deck title, at most 60 characters'),
    slides: z
      .array(
        z.object({
          title: z.string().describe('Slide title, at most 60 characters'),
          layout: z.enum([
            'title',
            'content',
            'two-column',
            'comparison',
            'section',
            'chart-focus',
          ]),
          visual: z.enum(['none', 'chart', 'table', 'image']).describe('Main visual on this slide'),
        }),
      )
      .min(3)
      .max(8),
  }),
});

let idSeq = 0;
const loopTools = {
  add_text: tool({
    description: 'Add a text box to a slide. Returns the new element id.',
    inputSchema: z.object({
      slideId: z.string(),
      role: z.enum(['title', 'body']),
      text: z.string().describe('Plain text; separate bullet points with newlines'),
    }),
    execute: async ({ slideId }) => ({ ok: true, slideId, newId: `el_smoke${++idSeq}` }),
  }),
  finish_turn: tool({
    description: 'Always call this last, once, to end your turn with a one-line summary.',
    inputSchema: z.object({
      summary: z.string(),
      suggestions: z.array(z.string()).max(3),
    }),
    execute: async () => ({ ok: true }),
  }),
};

const mask = (k) => (k ? `…${k.slice(-4)} (${k.length} chars)` : 'missing');
const ms = (t0) => `${Math.round(performance.now() - t0)} ms`;
const tokens = (u) => (u ? `${u.inputTokens ?? '?'} in / ${u.outputTokens ?? '?'} out` : 'n/a');

function explain(error) {
  // The SDK retries transient failures and then throws a RetryError; the cause is its lastError.
  const err = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(err)) {
    const s = err.statusCode;
    const hint =
      s === undefined
        ? 'could not reach the provider (network, DNS or proxy)'
        : s === 401 || s === 403
          ? 'key rejected: check the value and that it belongs to this provider'
          : s === 404
            ? 'model not found for this key: try another model id (see .env.example)'
            : s === 429
              ? 'rate limited or out of quota/credits'
              : s === 400
                ? 'request rejected (often an unsupported option or schema)'
                : s >= 500
                  ? 'provider error/overload: retry later'
                  : 'unexpected HTTP status';
    const body = err.responseBody ? `\n      ${String(err.responseBody).slice(0, 300)}` : '';
    return `HTTP ${s ?? '-'}: ${hint}\n      ${String(err.message).slice(0, 200)}${body}`;
  }
  return `${err?.name ?? 'Error'}: ${String(err?.message ?? err).slice(0, 300)}`;
}

async function forcedPlan(model, providerOptions) {
  const t0 = performance.now();
  const res = await generateText({
    model,
    tools: { plan_deck: planDeck },
    toolChoice: { type: 'tool', toolName: 'plan_deck' },
    instructions: 'You plan slide decks. Use the plan_deck tool.',
    prompt: 'Plan a 5-slide deck on our Q3 product roadmap, with at least one chart and one table.',
    maxOutputTokens: 1500,
    maxRetries: 1, // a quota error shouldn't burn extra credits
    providerOptions,
  });
  const call = res.toolCalls.find((c) => c.toolName === 'plan_deck');
  if (!call)
    throw new Error(
      `no plan_deck call (finishReason=${res.finishReason}, text="${res.text.slice(0, 80)}")`,
    );
  const parsed = planDeck.inputSchema.safeParse
    ? planDeck.inputSchema.safeParse(call.input)
    : { success: true };
  return {
    time: ms(t0),
    usage: tokens(res.usage),
    slides: call.input?.slides?.length,
    visuals: call.input?.slides?.map((s) => s.visual).join(','),
    valid: parsed.success !== false,
    finish: res.finishReason,
  };
}

async function streamedLoop(model, providerOptions) {
  const t0 = performance.now();
  const parts = [];
  const result = streamText({
    model,
    tools: loopTools,
    toolChoice: 'required',
    stopWhen: [hasToolCall('finish_turn'), stepCountIs(6)],
    instructions:
      'You edit slides only through tools. Add a title and a 3-bullet body to slide s_test1, then call finish_turn.',
    prompt: 'Fill slide s_test1 about "Why our Q3 revenue grew".',
    maxOutputTokens: 1500,
    maxRetries: 1,
    providerOptions,
    onError: () => {}, // errors also arrive as 'error' parts below; don't dump them to the console
  });
  for await (const p of result.fullStream) {
    if (p.type === 'error') throw p.error;
    if (['text-delta', 'tool-call', 'tool-result', 'finish-step'].includes(p.type)) {
      parts.push({ type: p.type, at: performance.now() - t0, tool: p.toolName });
    }
  }
  const calls = parts.filter((p) => p.type === 'tool-call');
  const first = parts[0]?.at ?? 0;
  const last = parts.at(-1)?.at ?? 0;
  return {
    time: ms(t0),
    usage: tokens(await result.totalUsage),
    toolCalls: calls.map((c) => c.tool).join(' → ') || 'none',
    finished: calls.some((c) => c.tool === 'finish_turn'),
    // "Streams" = parts arrived spread over time, not all at the very end.
    spreadMs: Math.round(last - first),
    steps: parts.filter((p) => p.type === 'finish-step').length,
  };
}

async function run(name) {
  const cfg = PROVIDERS[name];
  const key = process.env[cfg.envKey];
  console.log(`\n=== ${name}  model=${cfg.modelId}  key=${mask(key)}`);
  if (!key) {
    console.log(`  SKIPPED: set ${cfg.envKey} in .env`);
    return { name, status: 'skipped' };
  }
  const model = cfg.make(key, cfg.modelId);
  let ok = true;
  try {
    const r = await forcedPlan(model, cfg.providerOptions);
    console.log(
      `  1. forced plan_deck   OK   ${r.time}, ${r.usage}, ${r.slides} slides [${r.visuals}], schema ${r.valid ? 'valid' : 'INVALID'}`,
    );
    if (!r.valid) ok = false;
  } catch (e) {
    ok = false;
    console.log(`  1. forced plan_deck   FAIL ${explain(e)}`);
  }
  try {
    const r = await streamedLoop(model, cfg.providerOptions);
    console.log(
      `  2. streamed tool loop ${r.finished ? 'OK  ' : 'WARN'} ${r.time}, ${r.usage}, ${r.steps} steps: ${r.toolCalls}; parts spread over ${r.spreadMs} ms`,
    );
    if (!r.finished)
      console.log('     (model never called finish_turn: the agent prompt must insist on it)');
  } catch (e) {
    ok = false;
    console.log(`  2. streamed tool loop FAIL ${explain(e)}`);
  }
  return { name, status: ok ? 'ok' : 'failed' };
}

const wanted = process.argv[2] ? [process.argv[2]] : Object.keys(PROVIDERS);
const unknown = wanted.filter((n) => !PROVIDERS[n]);
if (unknown.length) {
  console.error(
    `Unknown provider: ${unknown.join(', ')}. Use one of: ${Object.keys(PROVIDERS).join(', ')}`,
  );
  process.exit(2);
}
const results = [];
for (const n of wanted) results.push(await run(n));
console.log(`\nSummary: ${results.map((r) => `${r.name}=${r.status}`).join('  ')}`);
process.exitCode = results.some((r) => r.status === 'failed') ? 1 : 0;
