import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readRequest } from '../../api/_lib/guard.js';

// D72: the size limit counts the bytes that arrive, not only the declared Content-Length.
const Any = z.object({ text: z.string() });
const body = (n) => JSON.stringify({ text: 'x'.repeat(n) });

/** A POST whose body is streamed in chunks with no Content-Length header (as when chunked). */
function chunked(text, ip) {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += 1000) c.enqueue(bytes.slice(i, i + 1000));
      c.close();
    },
  });
  return new Request('http://local/api/x', {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('readRequest body limit (D72)', () => {
  it('refuses a body without Content-Length once it passes the limit', async () => {
    const req = chunked(body(15_000), '10.0.0.1');
    expect(req.headers.get('content-length')).toBeNull();
    const res = await readRequest(req, Any, { maxBytes: 100 });
    expect(res.response.status).toBe(413);
  });

  it('refuses a body larger than its declared Content-Length claims', async () => {
    const req = chunked(body(5_000), '10.0.0.2');
    req.headers.set('content-length', '20');
    const res = await readRequest(req, Any, { maxBytes: 100 });
    expect(res.response.status).toBe(413);
  });

  it('accepts a body within the limit, including multi-byte text split across chunks', async () => {
    const text = JSON.stringify({ text: 'ओड़िआ '.repeat(300) });
    const res = await readRequest(chunked(text, '10.0.0.3'), Any, { maxBytes: 100_000 });
    expect(res.body.text).toBe('ओड़िआ '.repeat(300));
  });
});
