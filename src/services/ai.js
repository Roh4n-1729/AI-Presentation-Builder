import { toRequestDeck } from '../lib/agent/request.js';
import { createDeck } from '../lib/factories.js';
import { turnId as newTurnId } from '../lib/ids.js';
import { newMessageId } from '../store/chatSlice.js';
import { createOpApplier } from './aiOps.js';
import { ApiError, postSse } from './sseClient.js';

/*
 * AI runs, as plain functions over the store (D19: services know no React).
 *   runEdit       one patch-only agent turn            -> /api/agent
 *   generateDeck  plan, then populate slide by slide   -> /api/plan, /api/populate (D12)
 * Everything the AI does reaches the deck as ops through the store's dispatch, exactly like a
 * user edit; the chat message records which ops landed (chips) and how the run ended.
 */

const POPULATE_CONCURRENCY = 2; // free tiers rate-limit; 2 parallel keeps "slides appear" lively

let current = null; // { controller } of the run in flight (one at a time)

const ACTIVITY = {
  plan_deck: 'Planning the deck',
  add_text: 'Writing text',
  add_chart: 'Building a chart',
  add_table: 'Building a table',
  add_image: 'Placing an image',
  add_shape: 'Adding a shape',
  add_slide: 'Adding a slide',
  update_element: 'Editing',
  update_elements: 'Editing',
  update_chart_data: 'Updating chart data',
  change_chart_type: 'Changing chart type',
  move_element: 'Moving',
  get_slide: 'Reading the slide',
  update_slide: 'Writing speaker notes',
  finish_turn: 'Wrapping up',
};

/** Stop whatever is running. Whatever already landed stays (it's already in the deck and history). */
export function stopAi() {
  current?.controller.abort();
}

function begin(store) {
  if (current) throw new Error('An AI run is already in progress');
  const controller = new AbortController();
  current = { controller };
  store.getState().setAiBusy(true);
  return controller;
}

function end(store) {
  current = null;
  store.getState().setAiBusy(false);
}

const errorInfo = (err) =>
  err instanceof ApiError
    ? { code: err.code, message: err.message, retryAfter: err.retryAfter }
    : {
        code: 'NETWORK',
        message: 'Could not reach the server. Check your connection and try again.',
      };

/** Event handler shared by all three endpoints: status/tool -> activity, text -> message, op -> deck. */
function handlerFor(store, msgId, applier, extra = {}) {
  const patch = (p) => store.getState().patchMessage(msgId, p);
  let textBuf = '';
  let textScheduled = false;
  const flushText = () => {
    textScheduled = false;
    const add = textBuf;
    textBuf = '';
    if (add) patch((m) => ({ text: (m.text ?? '') + add }));
  };
  return (event, data) => {
    if (event === 'status') {
      if (data.phase === 'fallback')
        patch({ activity: `${data.from} unavailable, switching provider…` });
      else if (data.phase === 'retry') patch({ activity: `Retrying with ${data.from}…` });
      else patch({ provider: data.model ?? data.provider });
    } else if (event === 'tool' && data.state === 'start') {
      patch({ activity: ACTIVITY[data.name] ?? 'Working' });
    } else if (event === 'text') {
      textBuf += data.delta;
      if (!textScheduled) {
        textScheduled = true;
        (typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : (f) => setTimeout(f, 16))(flushText);
      }
    } else if (event === 'op') {
      applier.push(data);
    } else if (event === 'done') {
      applier.drain();
      flushText();
      extra.onDone?.(data);
    }
  };
}

/** Recent turns for the agent: user requests and the AI's own summaries (not the deck dumps). */
function historyFor(messages) {
  return messages
    .filter((m) => (m.role === 'user' ? m.text : m.status === 'done' && m.summary))
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.role === 'user' ? m.text : m.summary }));
}

/**
 * One edit turn: the user's request -> targeted patches.
 * @param {ReturnType<import('../store/index.js').createAppStore>} store
 */
export async function runEdit(store, text) {
  const s = store.getState();
  const history = historyFor(s.messages);
  const turnId = newTurnId();
  const msgId = newMessageId();
  s.addMessage({ id: newMessageId(), role: 'user', text });
  s.addMessage({
    id: msgId,
    role: 'assistant',
    kind: 'edit',
    text: '',
    status: 'streaming',
    turnId,
    chips: [],
    skipped: 0,
    activity: 'Thinking',
  });
  const controller = begin(store);
  const applier = createOpApplier(store, {
    turnId,
    onChips: (chips, skipped) =>
      store.getState().patchMessage(msgId, (m) => ({
        chips: [...m.chips, ...chips],
        skipped: m.skipped + skipped,
      })),
  });
  try {
    const st = store.getState();
    await postSse(
      '/api/agent',
      {
        deck: toRequestDeck(st.deck),
        message: text,
        history,
        activeSlideId: st.activeSlideId,
        selection: st.selection,
        turnId,
      },
      {
        signal: controller.signal,
        onEvent: handlerFor(store, msgId, applier, {
          onDone: (d) =>
            store
              .getState()
              .patchMessage(msgId, { summary: d.summary, suggestions: d.suggestions ?? [] }),
        }),
      },
    );
    applier.drain();
    store.getState().patchMessage(msgId, (m) => ({
      status: 'done',
      activity: null,
      summary:
        m.summary ||
        (m.chips.length
          ? `Made ${m.chips.length} change${m.chips.length === 1 ? '' : 's'}.`
          : 'No changes were needed.'),
    }));
  } catch (err) {
    applier.drain();
    const aborted = controller.signal.aborted;
    store.getState().patchMessage(msgId, {
      status: aborted ? 'stopped' : 'error',
      activity: null,
      error: aborted ? undefined : errorInfo(err),
      retry: aborted ? undefined : { kind: 'edit', text },
    });
  } finally {
    end(store);
  }
}

/**
 * Two-phase generation (D12): plan -> titled skeleton slides appear at once; then each slide is
 * filled by its own short request, POPULATE_CONCURRENCY at a time. A failed slide can be retried
 * alone; Stop keeps whatever landed.
 */
export async function generateDeck(store, { prompt, slideCount }) {
  const s = store.getState();
  const turnId = newTurnId();
  const msgId = newMessageId();
  // A fresh deck in the open project: same id, so the URL (/deck/:id) and the saved project
  // stay the same one (D59).
  s.replaceDeck(createDeck({ id: s.deck.id, title: 'Untitled presentation' }));
  s.addMessage({ id: newMessageId(), role: 'user', text: prompt });
  s.addMessage({
    id: msgId,
    role: 'assistant',
    kind: 'generate',
    text: '',
    status: 'streaming',
    turnId,
    chips: [],
    skipped: 0,
    phase: 'planning',
    activity: 'Planning the deck',
  });
  const controller = begin(store);
  const patch = (p) => store.getState().patchMessage(msgId, p);
  const applier = createOpApplier(store, {
    turnId,
    onChips: (chips, skipped) =>
      patch((m) => ({ chips: [...m.chips, ...chips], skipped: m.skipped + skipped })),
  });

  let plan;
  try {
    await postSse(
      '/api/plan',
      { deck: toRequestDeck(store.getState().deck), prompt, slideCount, turnId },
      {
        signal: controller.signal,
        onEvent: handlerFor(store, msgId, applier, { onDone: (d) => (plan = d.plan) }),
      },
    );
    applier.drain();
  } catch (err) {
    applier.drain();
    const aborted = controller.signal.aborted;
    patch({
      status: aborted ? 'stopped' : 'error',
      activity: null,
      error: aborted ? undefined : errorInfo(err),
      retry: aborted ? undefined : { kind: 'generate', prompt, slideCount },
    });
    end(store);
    return;
  }

  patch({
    phase: 'populating',
    // Saved with the message, so a reload mid-run can still offer "Continue building".
    retry: { kind: 'populate', prompt, briefs: plan.briefs, total: plan.briefs.length },
    outline: plan.briefs.map((b) => b.title),
    progress: { done: 0, total: plan.briefs.length },
    activity: null,
  });
  await populate(store, {
    msgId,
    turnId,
    prompt,
    briefs: plan.briefs,
    total: plan.briefs.length,
    controller,
    applier,
  });
}

/** Retry the slides that failed or were never filled (after an error or Stop). */
export async function continueGeneration(store, msgId) {
  const msg = store.getState().messages.find((m) => m.id === msgId);
  // Only slides that still exist and hold nothing but their title (after a reload mid-run the
  // saved list includes slides that were filled before the page closed).
  const deck = store.getState().deck;
  const briefs = (msg?.retry?.briefs ?? []).filter(
    (b) => deck.slides[b.slideId] && deck.slides[b.slideId].elementOrder.length <= 1,
  );
  if (!briefs.length) {
    store.getState().patchMessage(msgId, { retry: undefined });
    return;
  }
  const controller = begin(store);
  const applier = createOpApplier(store, {
    turnId: msg.turnId,
    onChips: (chips, skipped) =>
      store.getState().patchMessage(msgId, (m) => ({
        chips: [...m.chips, ...chips],
        skipped: m.skipped + skipped,
      })),
  });
  store.getState().patchMessage(msgId, {
    status: 'streaming',
    error: undefined,
    retry: undefined,
    failedSlides: [],
  });
  await populate(store, {
    msgId,
    turnId: msg.turnId,
    prompt: msg.retry.prompt,
    briefs,
    total: msg.retry.total,
    controller,
    applier,
    doneSoFar: msg.progress?.done ?? 0,
  });
}

async function populate(
  store,
  { msgId, turnId, prompt, briefs, total, controller, applier, doneSoFar = 0 },
) {
  const patch = (p) => store.getState().patchMessage(msgId, p);
  const failed = [];
  const started = new Set();
  let done = doneSoFar;
  let lastError;
  let next = 0;

  const worker = async () => {
    while (next < briefs.length && !controller.signal.aborted) {
      const brief = briefs[next++];
      started.add(brief.slideId);
      const deck = store.getState().deck;
      if (!deck.slides[brief.slideId]) continue; // user deleted the slide meanwhile
      const index = deck.slideOrder.indexOf(brief.slideId);
      patch({ activity: `Building slide ${index + 1}: ${brief.title}` });
      try {
        await postSse(
          '/api/populate',
          {
            deck: toRequestDeck(deck),
            slideId: brief.slideId,
            brief,
            userPrompt: prompt,
            index,
            total,
            turnId,
          },
          { signal: controller.signal, onEvent: handlerFor(store, msgId, applier) },
        );
        done += 1;
        patch({ progress: { done, total } });
      } catch (err) {
        if (controller.signal.aborted) return;
        failed.push(brief);
        lastError = errorInfo(err);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(POPULATE_CONCURRENCY, briefs.length) }, worker));
  applier.drain();

  const aborted = controller.signal.aborted;
  // Retry candidates: failed slides and slides never started. A slide that was mid-fill when Stop
  // hit keeps what landed and is not refilled (that could duplicate its elements).
  const notStarted = briefs.filter((b) => !started.has(b.slideId));
  const remaining = [...failed, ...notStarted].filter(
    (b) => store.getState().deck.slides[b.slideId],
  );
  const deck = store.getState().deck;
  patch({
    status: aborted ? 'stopped' : failed.length ? 'error' : 'done',
    phase: 'done',
    activity: null,
    error:
      !aborted && failed.length
        ? {
            ...lastError,
            message:
              `${failed.length} slide${failed.length > 1 ? 's' : ''} could not be filled. ${lastError?.message ?? ''}`.trim(),
          }
        : undefined,
    failedSlides: failed.map((b) => b.slideId),
    retry: remaining.length ? { kind: 'populate', prompt, briefs: remaining, total } : undefined,
    summary: aborted
      ? `Stopped. Kept ${done} of ${total} slides.`
      : `Created "${deck.title}": ${deck.slideOrder.length} slides${failed.length ? `, ${failed.length} still empty` : ''}.`,
    suggestions:
      failed.length || aborted
        ? []
        : [
            'Make slide 2 more concise',
            'Add a slide about pricing before the conclusion',
            'Change the tone to be more formal',
          ],
  });
  end(store);
}
