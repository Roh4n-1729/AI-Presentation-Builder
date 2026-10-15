/**
 * Live probe of the app's real AI path (the same handlers Vercel runs), one provider at a time:
 *   plan a 4-slide deck  ->  populate two slides  ->  one edit turn
 * Prints each SSE event in short form, timings, and whether the deck changes applied cleanly.
 *
 *   npm run llm:probe                 # every provider that has a key
 *   npm run llm:probe -- sarvam       # one provider
 *
 * Unlike llm:smoke (raw AI SDK calls), this exercises our tools, prompts, tool-choice policy and
 * fallback rules. Fallback is switched off so each provider is judged on its own.
 */
import { POST as agent } from '../api/agent.js';
import { POST as plan } from '../api/plan.js';
import { POST as populate } from '../api/populate.js';
import { createDeck } from '../src/lib/factories.js';
import { applyOps } from '../src/lib/ops/index.js';

const KEYS = {
  sarvam: 'SARVAM_API_KEY',
  gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
  groq: 'GROQ_API_KEY',
};
const only = process.argv[2];
const providers = Object.keys(KEYS).filter((p) => (!only || p === only) && process.env[KEYS[p]]);
if (!providers.length) {
  console.log(`No provider to probe (keys missing${only ? ` for ${only}` : ''}). Check .env.`);
  process.exit(1);
}

async function call(handler, body, label) {
  const t0 = Date.now();
  const res = await handler(
    new Request('http://probe/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  if (!res.ok) {
    console.log(`  ${label}: HTTP ${res.status} ${await res.text()}`);
    return { ok: false };
  }
  const raw = await res.text();
  const events = raw
    .split('\n\n')
    .filter((b) => b.startsWith('event:'))
    .map((b) => ({
      event: b.match(/^event: (.*)$/m)[1],
      data: JSON.parse(b.match(/^data: (.*)$/m)[1]),
    }));
  const ops = [];
  let text = '';
  const lines = [];
  let done = null;
  let error = null;
  for (const { event, data } of events) {
    if (event === 'status')
      lines.push(
        `status ${data.phase}${data.from ? ` from ${data.from}: ${data.reason}` : ` ${data.model}${data.streamed === false ? ' (non-streamed)' : ''}`}`,
      );
    else if (event === 'tool' && data.state !== 'start')
      lines.push(`tool ${data.name} ${data.state}${data.error ? `: ${data.error}` : ''}`);
    else if (event === 'op') ops.push(...data.ops);
    else if (event === 'text') text += data.delta;
    else if (event === 'error') error = data;
    else if (event === 'done') done = data;
  }
  const ms = Date.now() - t0;
  console.log(
    `  ${label}: ${error ? 'FAIL' : 'OK'}  ${ms} ms, ${ops.length} ops${done?.usage ? `, ${done.usage.inputTokens ?? '?'} in / ${done.usage.outputTokens ?? '?'} out` : ''}`,
  );
  for (const l of lines) console.log(`      ${l}`);
  if (text.trim()) console.log(`      text: ${text.trim().replace(/\s+/g, ' ').slice(0, 160)}`);
  if (done?.summary) console.log(`      summary: ${done.summary}`);
  if (error) console.log(`      error: ${error.code}: ${error.message}`);
  return { ok: !error, ops, done };
}

function apply(deck, ops) {
  try {
    applyOps(deck, ops);
    return true;
  } catch (e) {
    console.log(`      !! ops did not apply on the client copy: ${e.message}`);
    return false;
  }
}

for (const id of providers) {
  process.env.LLM_PROVIDER = id;
  process.env.LLM_FALLBACKS = '';
  console.log(`\n=== ${id}`);
  const deck = createDeck({ id: 'd_probe', title: 'Untitled presentation' });
  const p = await call(
    plan,
    {
      deck,
      prompt: 'A pitch for a neighbourhood composting startup in Pune, with a market-size chart',
      slideCount: 4,
      turnId: 't_plan',
    },
    'plan',
  );
  if (!p.ok || !apply(deck, p.ops)) continue;
  const briefs = p.done.plan.briefs;
  console.log(
    `      slides: ${briefs.map((b) => `${b.title} [${b.layout}, ${b.visual}]`).join(' | ')}`,
  );

  for (const [i, brief] of briefs.slice(1, 3).entries()) {
    const r = await call(
      populate,
      {
        deck,
        slideId: brief.slideId,
        brief,
        userPrompt: 'composting startup pitch',
        index: i + 1,
        total: briefs.length,
        turnId: 't_plan',
      },
      `populate slide ${i + 2}`,
    );
    if (r.ok) apply(deck, r.ops);
  }

  const target = deck.slideOrder[1];
  await call(
    agent,
    {
      deck,
      message: 'Make slide 2 more concise and add a one-line caption',
      history: [],
      activeSlideId: target,
      selection: [],
      turnId: 't_edit',
    },
    'edit',
  ).then((r) => r.ok && apply(deck, r.ops));
}
