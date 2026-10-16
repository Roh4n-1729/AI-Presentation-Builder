import { MAX_REQUEST_BYTES } from '../../src/lib/agent/request.js';

// Basic protection for the shared API keys (D23): body size limit and a per-IP rate limit.
// The limiter is in memory, so it is best-effort on serverless (instances don't share memory);
// it still stops a single client from hammering one warm instance.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MIN || 30);
const hits = new Map();

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

function rateLimited(request) {
  const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return list.length > MAX_PER_WINDOW ? Math.ceil((WINDOW_MS - (now - list[0])) / 1000) : 0;
}

/**
 * Validate a POST body against a Zod schema.
 * @returns {Promise<{ body: any } | { response: Response }>}
 */
export async function readRequest(request, schema, { maxBytes = MAX_REQUEST_BYTES } = {}) {
  const size = Number(request.headers.get('content-length') || 0);
  if (size > maxBytes) {
    return {
      response: json(413, {
        code: 'TOO_LARGE',
        message: 'Request too large. Images must not be sent with chat requests.',
      }),
    };
  }
  const wait = rateLimited(request);
  if (wait) {
    return {
      response: json(
        429,
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Slow down a little.',
          retryAfter: wait,
        },
        { 'Retry-After': String(wait) },
      ),
    };
  }
  let raw;
  try {
    raw = await request.json();
  } catch {
    return { response: json(400, { code: 'BAD_JSON', message: 'Body must be JSON.' }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: json(400, {
        code: 'BAD_REQUEST',
        message: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      }),
    };
  }
  return { body: parsed.data };
}
