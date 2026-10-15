import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const chain = { current: [] };
vi.mock('../../api/_lib/providers.js', () => ({ providerChain: () => chain.current }));
const { runTurn } = await import('../../api/_lib/runTurn.js');

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const toolStep = (toolName, input, id) => [
  { type: 'stream-start', warnings: [] },
  { type: 'tool-call', toolCallId: id, toolName, input: JSON.stringify(input) },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
];
const textStep = (text) => [
  { type: 'stream-start', warnings: [] },
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: text },
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
];
/** Plays `steps` in order across calls, recording the tool choice each call was given. */
const scripted = (steps, seen = []) => {
  let i = 0;
  return new MockLanguageModelV4({
    doStream: async (opts) => {
      seen.push(opts.toolChoice?.type);
      return { stream: simulateReadableStream({ chunks: steps[Math.min(i++, steps.length - 1)] }) };
    },
  });
};
const provider = (id, model) => ({
  id,
  modelId: `${id}-mock`,
  make: () => model,
  providerOptions: {},
});

function setup() {
  const events = [];
  const applied = { count: 0 };
  const tools = {
    add_text: {
      description: 'add',
      inputSchema: z.object({ text: z.string() }),
      execute: () => {
        applied.count += 1;
        return { ok: true };
      },
    },
    finish_turn: {
      description: 'end',
      inputSchema: z.object({ summary: z.string() }),
      execute: () => ({ ok: true }),
    },
  };
  const send = (event, data) => events.push({ event, data });
  return { events, applied, tools, send, signal: new AbortController().signal };
}

describe('runTurn tool choice (D36)', () => {
  beforeEach(() => {
    chain.current = [];
  });

  it('forces a tool only on the first step, so a prose ending after ops is fine', async () => {
    const seen = [];
    chain.current = [
      provider(
        'sarvam',
        scripted([toolStep('add_text', { text: 'a' }, 'c1'), textStep('Done!')], seen),
      ),
    ];
    const t = setup();
    const run = await runTurn({ ...t, prompt: 'go', phase: 'editing' });
    expect(run.provider).toBe('sarvam');
    expect(seen).toEqual(['required', 'auto']);
    expect(t.events.some((e) => e.event === 'text' && e.data.delta === 'Done!')).toBe(true);
  });

  it('Sarvam answering in prose on step 0: retries unforced, then falls back if still no ops', async () => {
    const seen = [];
    chain.current = [
      provider('sarvam', scripted([textStep('Here is a slide…')], seen)),
      provider(
        'gemini',
        scripted([
          toolStep('add_text', { text: 'a' }, 'g1'),
          toolStep('finish_turn', { summary: 's' }, 'g2'),
        ]),
      ),
    ];
    const t = setup();
    const run = await runTurn({
      ...t,
      prompt: 'go',
      phase: 'populating',
      isComplete: () => t.applied.count > 0,
    });
    expect(seen).toEqual(['required', 'auto']); // forced attempt, then the unforced retry
    expect(run.provider).toBe('gemini');
    expect(t.applied.count).toBe(1);
    const statuses = t.events.filter((e) => e.event === 'status').map((e) => e.data.phase);
    expect(statuses).toEqual(['populating', 'retry', 'populating', 'fallback', 'populating']);
  });

  it('keeps a forced single tool on every attempt (plan_deck)', async () => {
    const seen = [];
    chain.current = [
      provider('sarvam', scripted([toolStep('finish_turn', { summary: 's' }, 'c1')], seen)),
    ];
    const t = setup();
    await runTurn({
      ...t,
      prompt: 'go',
      toolChoice: { type: 'tool', toolName: 'finish_turn' },
      maxSteps: 1,
    });
    expect(seen).toEqual(['tool']);
  });

  it('a malformed Sarvam stream ("Type validation failed") retries the same provider non-streamed', async () => {
    const modes = [];
    const ok = scripted([toolStep('add_text', { text: 'a' }, 'c1'), textStep('ok')]);
    const broken = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error('Type validation failed: Value: {"choices":[{"delta":{}}]}');
      },
    });
    chain.current = [
      {
        id: 'sarvam',
        modelId: 'sarvam-mock',
        streams: true,
        providerOptions: {},
        make: ({ simulate } = {}) => (modes.push(simulate), simulate ? ok : broken),
      },
    ];
    const t = setup();
    const run = await runTurn({ ...t, prompt: 'go', phase: 'editing' });
    expect(modes).toEqual([false, true]);
    expect(run.provider).toBe('sarvam');
    expect(t.applied.count).toBe(1);
  });

  it('a forced plan call with empty input is retried once with the same forced tool', async () => {
    const seen = [];
    const plans = [];
    let n = 0;
    const model = new MockLanguageModelV4({
      doStream: async (opts) => {
        seen.push(opts.toolChoice?.type);
        n += 1;
        return {
          stream: simulateReadableStream({
            chunks: toolStep('finish_turn', n === 1 ? {} : { summary: 'plan' }, `p${n}`),
          }),
        };
      },
    });
    chain.current = [provider('sarvam', model)];
    const t = setup();
    t.tools.finish_turn.execute = (i) => (plans.push(i), { ok: true });
    const run = await runTurn({
      ...t,
      prompt: 'go',
      toolChoice: { type: 'tool', toolName: 'finish_turn' },
      maxSteps: 1,
      isComplete: () => plans.length > 0,
    });
    expect(run.provider).toBe('sarvam');
    expect(seen).toEqual(['tool', 'tool']);
    expect(plans).toEqual([{ summary: 'plan' }]);
  });
});
