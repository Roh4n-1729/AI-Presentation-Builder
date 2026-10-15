import { EventSourceParserStream } from 'eventsource-parser/stream';

/** An error from our API (non-2xx JSON body, or an `error` event in the stream). */
export class ApiError extends Error {
  constructor({ code = 'ERROR', message = 'Something went wrong', retryAfter } = {}) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * POST a JSON body and read Server-Sent Events back (D15).
 *   fetch owns the request, body and AbortSignal; TextDecoderStream handles multi-byte characters
 *   split across chunks (matters for Indic text); eventsource-parser handles SSE framing.
 * No automatic reconnect or retry: these are one-shot jobs, and re-sending would re-run the AI
 * turn (duplicate ops, double credits). Callers decide what to do on error.
 *
 * @param {string} url
 * @param {object} body
 * @param {{ signal?: AbortSignal, onEvent: (event: string, data: any) => void }} opts
 */
export async function postSse(url, body, { signal, onEvent }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let info = { code: `HTTP_${res.status}`, message: res.statusText || 'Request failed' };
    try {
      info = { ...info, ...(await res.json()) };
    } catch {
      /* not JSON (e.g. a platform error page) */
    }
    if (res.status === 429 && !info.retryAfter)
      info.retryAfter = Number(res.headers.get('Retry-After')) || 20;
    throw new ApiError(info);
  }
  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();
  let sawEnd = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    let data;
    try {
      data = JSON.parse(value.data);
    } catch {
      continue;
    }
    const event = value.event ?? 'message';
    if (event === 'error') throw new ApiError(data);
    if (event === 'done') sawEnd = true;
    onEvent(event, data);
  }
  if (!sawEnd)
    throw new ApiError({
      code: 'DISCONNECTED',
      message: 'The connection closed before the AI finished.',
    });
}
