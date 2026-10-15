import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Client <-> server flow without a network or keys: the browser services (src/services/ai.js)
 * call the real /api handlers through a stubbed fetch, and the handlers talk to a scripted mock
 * model. Checks the whole path: SSE framing, op emission, store dispatch, history, chat message.
 */

const script = { current: null };
vi.mock('../api/_lib/providers.js', () => ({
  providerChain: () => [
    {
      id: 'sarvam',
      modelId: 'sarvam-mock',
      providerOptions: {},
      make: () => new MockLanguageModelV4({ doStream: async (opts) => script.current(opts) }),
    },
  ],
}));

const routes = {
  '/api/plan': (await import('../api/plan.js')).POST,
  '/api/populate': (await import('../api/populate.js')).POST,
  '/api/agent': (await import('../api/agent.js')).POST,
};
const calls = [];
vi.stubGlobal('fetch', async (url, init) => {
  calls.push(url);
  return routes[url](new Request(`http://local${url}`, init));
});

const ai = await import('../src/services/ai.js');
const { createAppStore } = await import('../src/store/index.js');
const { createSampleDeck } = await import('../src/lib/sampleDeck.js');

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
let callSeq = 0;
const toolCall = (toolName, input) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: 'stream-start', warnings: [] },
      { type: 'tool-call', toolCallId: `c${++callSeq}`, toolName, input: JSON.stringify(input) },
      { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
    ],
  }),
});
const toolNames = (opts) => (opts.tools ?? []).map((t) => t.name);
const afterToolResult = (opts) => opts.prompt.at(-1)?.role === 'tool';

const PLAN = {
  title: 'Composting for Pune',
  slides: [
    { title: 'Why compost', layout: 'title', intent: 'Hook', keyPoints: [], visual: 'none' },
    {
      title: 'Waste by ward',
      layout: 'content',
      intent: 'Size of the problem',
      keyPoints: ['40% wet waste'],
      visual: 'none',
    },
    {
      title: 'Next steps',
      layout: 'content',
      intent: 'Ask',
      keyPoints: ['Pilot in 3 wards'],
      visual: 'none',
    },
  ],
};

/** The model: plan when offered plan_deck, otherwise one content tool then finish_turn. */
function defaultModel(opts) {
  const names = toolNames(opts);
  if (names.includes('plan_deck')) return toolCall('plan_deck', PLAN);
  if (afterToolResult(opts)) return toolCall('finish_turn', { summary: 'Done.' });
  return toolCall('add_text', { role: 'body', paragraphs: ['Point one', 'Point two'] });
}

describe('generate -> edit through the real endpoints (mock model)', () => {
  let store;
  beforeEach(() => {
    store = createAppStore(createSampleDeck());
    script.current = defaultModel;
    calls.length = 0;
  });

  it('generates: plan creates skeleton slides, populate fills each, message ends done', async () => {
    await ai.generateDeck(store, { prompt: 'Composting startup pitch' });
    const s = store.getState();
    expect(s.aiBusy).toBe(false);
    expect(s.deck.title).toBe('Composting for Pune');
    expect(s.deck.slideOrder.map((id) => s.deck.slides[id].title)).toEqual(
      PLAN.slides.map((p) => p.title),
    );
    // every slide: its title element plus one body text box from populate
    for (const id of s.deck.slideOrder) expect(s.deck.slides[id].elementOrder).toHaveLength(2);
    expect(calls.filter((u) => u === '/api/populate')).toHaveLength(3);

    const msg = s.messages.at(-1);
    expect(msg).toMatchObject({ role: 'assistant', kind: 'generate', status: 'done' });
    expect(msg.progress).toEqual({ done: 3, total: 3 });
    expect(msg.chips[0].label).toBe('Planned 3 slides');
    expect(msg.chips.filter((c) => c.label.startsWith('Added text'))).toHaveLength(3);
  });

  it('edits: one agent turn = one undo entry, chips point at the changed element', async () => {
    const before = store.getState().deck;
    const target = before.slides[before.slideOrder[1]].elementOrder.at(-1);
    script.current = (opts) =>
      afterToolResult(opts)
        ? toolCall('finish_turn', { summary: 'Tightened slide 2.' })
        : toolCall('update_element', { elementId: target, paragraphs: ['Shorter'] });

    await ai.runEdit(store, 'Make slide 2 more concise');
    const s = store.getState();
    const msg = s.messages.at(-1);
    expect(msg).toMatchObject({ status: 'done', summary: 'Tightened slide 2.' });
    expect(msg.chips).toEqual([
      { label: 'Edited · slide 2', slideId: before.slideOrder[1], elementIds: [target] },
    ]);
    expect(s.past.at(-1)).toMatchObject({ source: 'ai', turnId: msg.turnId });
    expect(s.aiFlash[before.slideOrder[1]].elementIds).toEqual([target]);

    s.undo();
    expect(store.getState().deck).toEqual(before);
  });

  it('a provider error before any op shows a retryable error on the message', async () => {
    script.current = async () => {
      throw Object.assign(new Error('rate limited'), { statusCode: 429, isRetryable: false });
    };
    await ai.runEdit(store, 'Add a chart');
    const msg = store.getState().messages.at(-1);
    expect(msg.status).toBe('error');
    expect(msg.error.code).toBe('RATE_LIMITED');
    expect(msg.retry).toEqual({ kind: 'edit', text: 'Add a chart' });
    expect(store.getState().aiBusy).toBe(false);
  });

  it('a failed populate leaves that slide empty and offers to retry only it', async () => {
    let populateCalls = 0;
    script.current = (opts) => {
      if (toolNames(opts).includes('plan_deck')) return toolCall('plan_deck', PLAN);
      if (!afterToolResult(opts) && ++populateCalls === 2) {
        throw Object.assign(new Error('down'), { statusCode: 503, isRetryable: false });
      }
      return defaultModel(opts);
    };
    await ai.generateDeck(store, { prompt: 'Pitch' });
    const msg = store.getState().messages.at(-1);
    expect(msg.status).toBe('error');
    expect(msg.retry.kind).toBe('populate');
    expect(msg.retry.briefs).toHaveLength(1);

    script.current = defaultModel;
    await ai.continueGeneration(store, msg.id);
    const after = store.getState();
    expect(after.messages.at(-1).status).toBe('done');
    for (const id of after.deck.slideOrder)
      expect(after.deck.slides[id].elementOrder).toHaveLength(2);
  });
});
