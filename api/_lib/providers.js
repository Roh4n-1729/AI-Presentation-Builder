import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { simulateStreamingMiddleware, wrapLanguageModel } from 'ai';
import { createSarvam } from 'sarvam-ai-sdk';

/*
 * Provider chain (D14, D27): primary first, then fallbacks, all from env. A provider without a key
 * is skipped.
 *
 * Sarvam runs non-streamed by default (D37): its streamed tool-call chunks fail sarvam-ai-sdk's chunk
 * schema ("Type validation failed"), while whole responses parse fine. simulateStreamingMiddleware
 * makes each step one normal request replayed as a stream, so tools, ops and chips work unchanged;
 * only token-by-token text is lost. SARVAM_STREAM=true opts back into real streaming.
 */

const PROVIDERS = {
  sarvam: {
    key: 'SARVAM_API_KEY',
    model: () => process.env.SARVAM_MODEL || 'sarvam-105b',
    make: ({ simulate } = {}) => {
      const model = createSarvam({ apiKey: process.env.SARVAM_API_KEY })(PROVIDERS.sarvam.model(), {
        reasoning_effort: process.env.SARVAM_REASONING || 'low', // reasoning tokens count against max_tokens
      });
      const noStream = simulate || process.env.SARVAM_STREAM !== 'true';
      return noStream
        ? wrapLanguageModel({ model, middleware: simulateStreamingMiddleware() })
        : model;
    },
    providerOptions: {},
  },
  gemini: {
    key: 'GOOGLE_GENERATIVE_AI_API_KEY',
    model: () => process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    make: () =>
      createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(
        PROVIDERS.gemini.model(),
      ),
    providerOptions: {},
  },
  groq: {
    key: 'GROQ_API_KEY',
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    make: () => createGroq({ apiKey: process.env.GROQ_API_KEY })(PROVIDERS.groq.model()),
    providerOptions: { groq: { reasoningEffort: 'low' } },
  },
};

/** @returns {{ id: string, modelId: string, streams: boolean, make: Function, providerOptions: object }[]} */
export function providerChain() {
  const order = [
    process.env.LLM_PROVIDER || 'sarvam',
    ...(process.env.LLM_FALLBACKS ?? 'gemini,groq').split(','),
  ]
    .map((s) => s.trim())
    .filter((id, i, all) => id && PROVIDERS[id] && all.indexOf(id) === i);
  return order
    .filter((id) => process.env[PROVIDERS[id].key])
    .map((id) => ({
      id,
      modelId: PROVIDERS[id].model(),
      streams: id !== 'sarvam' || process.env.SARVAM_STREAM === 'true',
      make: PROVIDERS[id].make,
      providerOptions: PROVIDERS[id].providerOptions,
    }));
}
