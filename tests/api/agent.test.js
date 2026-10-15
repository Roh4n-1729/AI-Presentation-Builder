import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDeck } from '../../src/lib/test-fixtures.js';

// Replace the real provider chain with scripted mock models (no network, no keys).
const chain = { current: [] };
vi.mock('../../api/_lib/providers.js', () => ({ providerChain: () => chain.current }));
const { POST } = await import('../../api/agent.js');

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const toolStep = (toolName, input, id) => [
  { type: 'stream-start', warnings: [] },
  { type: 'tool-call', toolCallId: id, toolName, input: JSON.stringify(input) },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
];
/** A model that plays the given steps in order, one per model call. */
const scripted = (steps) => {
  let i = 0;
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: steps[Math.min(i++, steps.length - 1)] }),
    }),
  });
};
const failing = (statusCode) =>
  new MockLanguageModelV4({
    doStream: async () => {
      throw Object.assign(new Error(`HTTP ${statusCode}`), { statusCode, isRetryable: false });
    },
  });
const provider = (id, model) => ({
  id,
  modelId: `${id}-mock`,
  make: () => model,
  providerOptions: {},
});

async function call(body) {
  const res = await POST(
    new Request('http://x/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  const events = text
    .split('\n\n')
    .filter((b) => b.startsWith('event:'))
    .map((b) => ({
      event: b.match(/^event: (.*)$/m)[1],
      data: JSON.parse(b.match(/^data: (.*)$/m)[1]),
    }));
  return { res, events };
}
const body = (message = 'Make slide 2 more concise') => ({
  deck: makeDeck(),
  message,
  turnId: 't_test1',
  activeSlideId: 's_bbbbb',
  selection: [],
});

describe('/api/agent over SSE (mock model)', () => {
  beforeEach(() => {
    chain.current = [];
  });

  it('streams ops as tools complete, then done with the finish_turn summary', async () => {
    chain.current = [
      provider(
        'sarvam',
        scripted([
          toolStep('update_element', { elementId: 'el_body', paragraphs: ['+31% YoY'] }, 'c1'),
          toolStep(
            'finish_turn',
            { summary: 'Tightened slide 2.', suggestions: ['Add a chart'] },
            'c2',
          ),
        ]),
      ),
    ];
    const { res, events } = await call(body());
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const names = events.map((e) => e.event);
    expect(names[0]).toBe('status');
    const op = events.find((e) => e.event === 'op');
    expect(op.data).toMatchObject({ toolName: 'update_element', turnId: 't_test1' });
    expect(op.data.ops[0]).toMatchObject({ type: 'update_element', elementId: 'el_body' });
    expect(names.at(-1)).toBe('done');
    expect(events.at(-1).data).toMatchObject({
      summary: 'Tightened slide 2.',
      suggestions: ['Add a chart'],
      provider: 'sarvam',
    });
    expect(names.indexOf('op')).toBeLessThan(names.indexOf('done'));
  });

  it('a bad tool call becomes a tool error the model sees, not an op', async () => {
    chain.current = [
      provider(
        'sarvam',
        scripted([
          toolStep('delete_element', { elementId: 'el_ghost' }, 'c1'),
          toolStep('finish_turn', { summary: 'Nothing to delete.', suggestions: [] }, 'c2'),
        ]),
      ),
    ];
    const { events } = await call(body('delete the ghost'));
    expect(events.some((e) => e.event === 'op')).toBe(false);
    expect(events.find((e) => e.event === 'tool' && e.data.state === 'error').data.error).toContain(
      'NOT_FOUND',
    );
  });

  it('falls back to the next provider when the first fails before any op', async () => {
    chain.current = [
      provider('sarvam', failing(429)),
      provider(
        'gemini',
        scripted([toolStep('finish_turn', { summary: 'ok', suggestions: [] }, 'c1')]),
      ),
    ];
    const { events } = await call(body('hi'));
    expect(events.find((e) => e.event === 'status' && e.data.phase === 'fallback').data.from).toBe(
      'sarvam',
    );
    expect(events.at(-1)).toMatchObject({ event: 'done', data: { provider: 'gemini' } });
  });

  it('does not fall back once ops have streamed (no duplicates); reports an error instead', async () => {
    let n = 0;
    const flaky = new MockLanguageModelV4({
      doStream: async () => {
        n += 1;
        if (n === 1)
          return {
            stream: simulateReadableStream({
              chunks: toolStep('update_element', { elementId: 'el_body', paragraphs: ['x'] }, 'c1'),
            }),
          };
        throw Object.assign(new Error('HTTP 503'), { statusCode: 503, isRetryable: false });
      },
    });
    chain.current = [
      provider('sarvam', flaky),
      provider(
        'gemini',
        scripted([toolStep('finish_turn', { summary: 'dup', suggestions: [] }, 'c9')]),
      ),
    ];
    const { events } = await call(body());
    expect(events.filter((e) => e.event === 'op')).toHaveLength(1);
    expect(events.at(-1).event).toBe('error');
    expect(events.some((e) => e.event === 'done')).toBe(false);
  });

  it('rejects bad bodies and missing providers cleanly', async () => {
    const bad = await POST(
      new Request('http://x/api/agent', { method: 'POST', body: JSON.stringify({ message: 'x' }) }),
    );
    expect(bad.status).toBe(400);
    chain.current = [];
    const { events } = await call(body());
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'NO_PROVIDER' } });
  });
});
