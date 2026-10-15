import { existsSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { loadEnv } from 'vite';

/**
 * Dev only: serve the Vercel functions in api/ from the Vite dev server (D36), so `npm run dev`
 * is the whole app and no Vercel CLI or project link is needed locally.
 *
 *   POST /api/agent  ->  api/agent.js  export POST(request: Request): Response
 *
 * Handlers get a Web Request (with an AbortSignal that fires when the browser disconnects, like
 * Vercel's supportsCancellation) and their Response body is piped back unbuffered, so SSE streams
 * exactly as in production. Keys come from .env (or .env.local) into process.env for the server side
 * only; nothing is exposed to the browser bundle (that would need a VITE_ prefix).
 */
export function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;

      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\/+/, '').split('/')[0];
        const file = path.join(server.config.root, 'api', `${name}.js`);
        if (!name || name.startsWith('_') || !existsSync(file)) return next();
        try {
          const mod = await server.ssrLoadModule(file); // re-evaluated after edits
          const handler = mod[req.method];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end('Method Not Allowed');
          }
          const controller = new AbortController();
          res.on('close', () => {
            if (!res.writableFinished) controller.abort();
          });
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
          const request = new Request(`http://${req.headers.host}${req.originalUrl ?? req.url}`, {
            method: req.method,
            headers: Object.entries(req.headers).flatMap(([k, v]) =>
              v == null ? [] : Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]],
            ),
            body: hasBody ? Readable.toWeb(req) : undefined,
            duplex: hasBody ? 'half' : undefined,
            signal: controller.signal,
          });
          const response = await handler(request);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.flushHeaders();
          if (!response.body) return res.end();
          for await (const chunk of response.body) res.write(chunk);
          res.end();
        } catch (err) {
          if (res.headersSent) return res.end();
          server.config.logger.error(`[local-api] ${name}: ${err?.stack ?? err}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ code: 'INTERNAL', message: String(err?.message ?? err) }));
        }
      });
    },
  };
}
