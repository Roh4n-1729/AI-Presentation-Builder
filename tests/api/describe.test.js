import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

// Replace the real Gemini model with a mock (no network, no keys).
const vision = { current: null };
vi.mock('../../api/_lib/providers.js', () => ({ visionModel: () => vision.current }));
const { POST } = await import('../../api/describe.js');

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const post = (body) =>
  POST(
    new Request('http://x/api/describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('/api/describe (D58)', () => {
  it('sends the image to the vision model and returns its description', async () => {
    let prompt;
    vision.current = {
      modelId: 'gemini-test',
      model: new MockLanguageModelV4({
        doGenerate: async (opts) => {
          prompt = opts.prompt;
          return {
            content: [{ type: 'text', text: '  A chessboard,\n white to move. ' }],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage,
            warnings: [],
          };
        },
      }),
    };
    const warnings = [];
    const onWarning = (w) => warnings.push(String(w.code ?? w.message));
    globalThis.process.on('warning', onWarning);
    const res = await post({ image: JPEG, alt: 'lichess fen' });
    await new Promise((r) => setTimeout(r, 0)); // warnings are emitted on the next tick
    globalThis.process.off('warning', onWarning);
    expect(warnings.filter((w) => /AISDK_DEP/.test(w))).toEqual([]); // no deprecated parts
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      description: 'A chessboard, white to move.',
      model: 'gemini-test',
    });
    const parts = prompt.at(-1).content;
    expect(parts.find((p) => p.type === 'file')?.mediaType).toBe('image/jpeg');
    expect(JSON.stringify(parts)).toContain('lichess fen');
  });

  it('says so when no vision model is configured', async () => {
    vision.current = null;
    const res = await post({ image: JPEG });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('NO_VISION');
  });

  it('accepts only a base64 JPEG data URL', async () => {
    vision.current = null;
    expect((await post({ image: 'https://example.com/a.jpg' })).status).toBe(400);
    expect((await post({ image: 'data:image/png;base64,AAAA' })).status).toBe(400);
  });
});
