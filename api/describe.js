import { generateText } from 'ai';
import { z } from 'zod';
import { readRequest } from './_lib/guard.js';
import { visionModel } from './_lib/providers.js';

/*
 * Image description (D58). The chat models can't see pictures (sarvam-105b is text-only, and chat
 * requests carry no image data, D13), so each picture is described once: the browser sends one
 * small JPEG (≤ 768 px) here, Gemini answers with a short factual description, and the browser
 * stores it on the element. Every later AI turn reads that text in the deck context.
 */

const MAX_BYTES = 600_000; // a 768 px JPEG is ~50–150 KB; base64 adds a third

const Body = z.object({
  image: z
    .string()
    .max(MAX_BYTES)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, 'a base64 JPEG data URL'),
  alt: z.string().max(300).optional(),
});

const PROMPT = `Describe this image from a presentation slide for an assistant that cannot see it.
In at most 70 words: what it shows; any readable text, numbers or labels; for a chart or diagram, its type and key values; for a board game or puzzle, the position. Be factual, no opinions, no preamble.`;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function POST(request) {
  const req = await readRequest(request, Body, { maxBytes: MAX_BYTES + 2_000 });
  if (req.response) return req.response;
  const vision = visionModel();
  if (!vision)
    return json(503, {
      code: 'NO_VISION',
      message: 'Image descriptions need GOOGLE_GENERATIVE_AI_API_KEY (Gemini).',
    });

  const { image, alt } = req.body;
  try {
    const { text } = await generateText({
      model: vision.model,
      maxOutputTokens: 300,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: alt ? `${PROMPT}\nThe author's caption: "${alt}".` : PROMPT },
            // AI SDK v7: images go in a "file" part (the "image" part is deprecated).
            {
              type: 'file',
              data: { type: 'data', data: image.slice(image.indexOf(',') + 1) },
              mediaType: 'image/jpeg',
            },
          ],
        },
      ],
    });
    const description = text.replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!description) return json(502, { code: 'EMPTY', message: 'No description came back.' });
    return json(200, { description, model: vision.modelId });
  } catch (err) {
    const status = err?.statusCode === 429 ? 429 : 502;
    return json(status, {
      code: status === 429 ? 'RATE_LIMITED' : 'VISION_FAILED',
      message: String(err?.message ?? err).slice(0, 200),
    });
  }
}
