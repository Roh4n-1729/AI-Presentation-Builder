import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { createDeck } from '../../src/lib/factories.js';

const chain = { current: [] };
vi.mock('../../api/_lib/providers.js', () => ({ providerChain: () => chain.current }));
const { POST } = await import('../../api/plan.js');

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

describe('/api/plan (mock model)', () => {
  it('turns a forced plan_deck call into one batch of skeleton slides plus briefs', async () => {
    let seen;
    const model = new MockLanguageModelV4({
      doStream: async (opts) => {
        seen = opts;
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-call',
                toolCallId: 'c1',
                toolName: 'plan_deck',
                input: JSON.stringify({
                  title: 'Q3 Roadmap',
                  slides: [
                    {
                      title: 'Q3 Roadmap',
                      layout: 'title',
                      intent: 'Open',
                      keyPoints: [],
                      visual: 'none',
                    },
                    {
                      title: 'Revenue grew 31%',
                      layout: 'chart-focus',
                      intent: 'Growth',
                      keyPoints: ['Q3 $5.1M'],
                      visual: 'chart',
                    },
                    {
                      title: 'Pricing',
                      layout: 'two-column',
                      intent: 'Tiers',
                      keyPoints: [],
                      visual: 'table',
                    },
                  ],
                }),
              },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
            ],
          }),
        };
      },
    });
    chain.current = [{ id: 'sarvam', modelId: 'mock', make: () => model, providerOptions: {} }];
    const res = await POST(
      new Request('http://x/api/plan', {
        method: 'POST',
        body: JSON.stringify({
          deck: createDeck({ id: 'd_new' }),
          prompt: 'Q3 roadmap deck',
          slideCount: 3,
          turnId: 't_plan1',
        }),
      }),
    );
    const events = (await res.text())
      .split('\n\n')
      .filter((b) => b.startsWith('event:'))
      .map((b) => ({
        event: b.match(/^event: (.*)$/m)[1],
        data: JSON.parse(b.match(/^data: (.*)$/m)[1]),
      }));

    expect(seen.toolChoice).toEqual({ type: 'tool', toolName: 'plan_deck' }); // forced, phase 1
    const ops = events.filter((e) => e.event === 'op');
    expect(ops).toHaveLength(1);
    expect(ops[0].data.ops.map((o) => o.type)).toEqual([
      'update_deck',
      'add_slide',
      'add_slide',
      'add_slide',
    ]);
    const done = events.at(-1);
    expect(done.event).toBe('done');
    expect(done.data.plan.briefs.map((b) => b.visual)).toEqual(['none', 'chart', 'table']);
  });
});
