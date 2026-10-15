// Server-Sent Events over a POST response (D15). One protocol for /api/plan, /api/populate and
// /api/agent: status · text · tool · op · error · done, plus a comment-line heartbeat.

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/** A typed failure we can report to the client with a stable code. */
export class AgentError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

/** Turn any error into the `error` event payload the client understands. */
export function errorPayload(err) {
  const cause = err?.lastError ?? err; // AI SDK RetryError wraps the real cause
  const status = cause?.statusCode;
  if (err instanceof AgentError)
    return { code: err.code, message: err.message, retryAfter: err.retryAfter };
  if (status === 429)
    return {
      code: 'RATE_LIMITED',
      message: 'The AI provider is busy or out of quota. Try again shortly.',
      retryAfter: 20,
    };
  if (status === 401 || status === 403)
    return { code: 'AUTH', message: 'The AI provider rejected the API key.' };
  if (status >= 500)
    return {
      code: 'PROVIDER_DOWN',
      message: 'The AI provider had an error. Try again.',
      retryAfter: 10,
    };
  if (cause?.name === 'AbortError') return { code: 'ABORTED', message: 'Stopped.' };
  return {
    code: 'AGENT_ERROR',
    message: String(cause?.message ?? cause ?? 'Unknown error').slice(0, 300),
  };
}

/**
 * Run `work(send, signal)` and stream whatever it sends. The response starts immediately; errors
 * thrown by `work` become an `error` event; the stream always ends cleanly.
 */
export function sseResponse(request, work) {
  const enc = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      write(': open\n\n');
      const heartbeat = setInterval(() => write(': hb\n\n'), 15000);
      try {
        await work(send, request.signal);
      } catch (err) {
        if (!request.signal.aborted) send('error', errorPayload(err));
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
