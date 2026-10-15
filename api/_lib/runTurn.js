import { hasToolCall, stepCountIs, streamText, tool } from 'ai';
import { AgentError } from './sse.js';
import { providerChain } from './providers.js';

/** The Sarvam provider rejects some streamed tool-call chunks; retry that provider without streaming. */
const isStreamShapeError = (e) =>
  /InvalidResponseData|Expected 'function' type|Type validation failed|TypeValidation/i.test(
    `${e?.name} ${e?.message}`,
  ) && !e?.statusCode;

/** The model answered in prose although a tool call was required (seen with Sarvam). */
const isToolChoiceViolation = (e) => /ToolChoiceViolation/i.test(`${e?.name} ${e?.message}`);

/**
 * How hard to push for tool calls, per step (D36):
 *   'first'  step 0 must call a tool, later steps may answer in text (a model that ends a turn with
 *            a sentence instead of finish_turn is fine; requiring a tool there makes the SDK throw
 *            after ops have already landed)
 *   'auto'   never forced (retry mode for a provider that ignores tool_choice=required)
 *   { type: 'tool', toolName }  forced single tool (plan_deck)
 */
const toolChoiceFor = (mode, stepNumber) =>
  typeof mode === 'object' ? mode : mode === 'first' && stepNumber === 0 ? 'required' : 'auto';

export async function runTurn({
  send,
  signal,
  tools,
  applied,
  instructions,
  prompt,
  messages,
  toolChoice = 'first',
  maxSteps = 10,
  maxOutputTokens = 3000,
  phase,
  // Checked after a run: false = the attempt failed (populate added nothing, plan_deck came
  // back empty or invalid), so the retry and fallback rules apply.
  isComplete = () => true,
}) {
  const chain = providerChain();
  if (chain.length === 0)
    throw new AgentError('NO_PROVIDER', 'No AI provider key is configured on the server.');
  const sdkTools = Object.fromEntries(
    Object.entries(tools).map(([name, def]) => [name, tool(def)]),
  );
  let lastError;

  for (const provider of chain) {
    // Attempts per provider: as configured first; Sarvam gets one retry in a degraded mode that
    // matches the failure (non-streamed if the stream was malformed, unforced tool choice if it
    // ignored "required"). Retries happen only while no op has been applied.
    const attempts = [{ simulate: false, choice: toolChoice }];
    for (let i = 0; i < attempts.length; i++) {
      const { simulate, choice } = attempts[i];
      try {
        send('status', {
          phase,
          provider: provider.id,
          model: provider.modelId,
          streamed: provider.streams !== false && !simulate,
        });
        const { usage, finishReason } = await attempt({
          provider,
          simulate,
          sdkTools,
          send,
          signal,
          instructions,
          prompt,
          messages,
          toolChoice: choice,
          maxSteps,
          maxOutputTokens,
        });
        if (!signal.aborted && !isComplete())
          throw new AgentError(
            'INCOMPLETE',
            `The model ended without a usable result (finish: ${finishReason ?? 'unknown'}).`,
          );
        return { provider: provider.id, model: provider.modelId, usage };
      } catch (err) {
        lastError = err;
        if (!signal.aborted) console.warn(`[runTurn] ${provider.id}:`, err?.message ?? err);
        if (signal.aborted || applied.count > 0) throw err; // can't safely retry once ops are out
        if (provider.id === 'sarvam' && attempts.length === 1) {
          if (isStreamShapeError(err) && provider.streams)
            attempts.push({ simulate: true, choice: toolChoice });
          else if (isToolChoiceViolation(err) && typeof toolChoice !== 'object')
            attempts.push({ simulate: false, choice: 'auto' });
          else if (err?.code === 'INCOMPLETE')
            // forced tool: same settings again (an empty or truncated call is often a one-off);
            // otherwise unforced, in case "required" is what made it misbehave
            attempts.push({
              simulate: false,
              choice: typeof toolChoice === 'object' ? toolChoice : 'auto',
            });
        }
        send('status', {
          phase: i + 1 < attempts.length ? 'retry' : 'fallback',
          from: provider.id,
          reason: String(err?.lastError?.message ?? err?.message ?? err).slice(0, 160),
        });
      }
    }
  }
  throw lastError;
}

async function attempt({
  provider,
  simulate,
  sdkTools,
  send,
  signal,
  instructions,
  prompt,
  messages,
  toolChoice,
  maxSteps,
  maxOutputTokens,
}) {
  const result = streamText({
    model: provider.make({ simulate }),
    tools: sdkTools,
    prepareStep: ({ stepNumber }) => ({ toolChoice: toolChoiceFor(toolChoice, stepNumber) }),
    instructions,
    ...(messages ? { messages } : { prompt }),
    stopWhen: [hasToolCall('finish_turn'), hasToolCall('plan_deck'), stepCountIs(maxSteps)],
    maxOutputTokens,
    maxRetries: 2, // the SDK backs off on 429/5xx ("high demand") before we fall back
    abortSignal: signal,
    providerOptions: provider.providerOptions,
    onError: () => {}, // surfaced below as 'error' parts
  });
  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-delta':
        if (part.text) send('text', { delta: part.text });
        break;
      case 'tool-input-start':
        send('tool', { name: part.toolName, id: part.id, state: 'start' });
        break;
      case 'tool-result': {
        const failed = part.output && part.output.ok === false;
        send('tool', {
          name: part.toolName,
          id: part.toolCallId,
          state: failed ? 'error' : 'done',
          error: failed ? part.output.error : undefined,
        });
        break;
      }
      case 'tool-error':
        send('tool', {
          name: part.toolName,
          id: part.toolCallId,
          state: 'error',
          error: String(part.error?.message ?? part.error).slice(0, 200),
        });
        break;
      case 'error':
        throw part.error;
      default:
        break;
    }
  }
  return { usage: await result.totalUsage, finishReason: await result.finishReason };
}
