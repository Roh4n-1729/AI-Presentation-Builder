// Day-1 streaming check (D18): does a Vercel Node function stream SSE without buffering,
// and does a client Stop reach the function as request.signal 'abort'?
// The real endpoints (/api/plan, /api/populate, /api/agent) reuse these headers.
// Delete this file once those endpoints stream in production.

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function POST(request) {
  const encoder = new TextEncoder();
  const started = Date.now();
  request.signal.addEventListener('abort', () => {
    console.log(`[sse-test] request aborted after ${Date.now() - started}ms`);
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      controller.enqueue(encoder.encode(': connected\n\n')); // comment line = heartbeat format
      for (let i = 1; i <= 12; i += 1) {
        if (request.signal.aborted) {
          controller.close(); // end our side cleanly; on Vercel the function is also terminated
          return;
        }
        send('tick', { i, serverMs: Date.now() - started });
        await sleep(400);
      }
      send('done', { serverMs: Date.now() - started });
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
