import { findElement } from '../lib/ops/index.js';

/*
 * Applying streamed AI ops to the canonical store (D2, D15, D25).
 * Incoming op events are queued and flushed once per animation frame: a burst of ops = one render.
 * Each tool's ops go through dispatch on their own (source 'ai', the turn's id), so they all land
 * in one history entry, and an op whose target the user deleted mid-stream is skipped alone.
 */

const VERB = {
  plan_deck: 'Planned slides',
  add_slide: 'Added slide',
  update_slide: 'Updated slide',
  delete_slide: 'Deleted slide',
  duplicate_slide: 'Duplicated slide',
  reorder_slides: 'Reordered slides',
  change_layout: 'Changed layout',
  add_text: 'Added text',
  add_chart: 'Added chart',
  add_table: 'Added table',
  add_image: 'Added image',
  add_shape: 'Added shape',
  update_element: 'Edited',
  update_elements: 'Edited',
  delete_element: 'Deleted element',
  move_element: 'Moved',
  resize_element: 'Resized',
  reorder_elements: 'Reordered layers',
  update_chart_data: 'Updated chart data',
  change_chart_type: 'Changed chart type',
};

/** Ids an op is about, read from the op itself (works for adds, edits, moves and slide ops). */
function opTargets(op) {
  const els = [op.elementId, op.element?.id, op.newId].filter(Boolean);
  const slides = [op.slideId, op.toSlideId, op.slide?.id, op.newSlideId].filter(Boolean);
  return { els, slides };
}

/** A clickable chip for one tool's ops: "Added chart · slide 3". */
export function chipFor({ toolName, ops }, deck) {
  const els = new Set();
  const slides = new Set();
  for (const op of ops) {
    const t = opTargets(op);
    t.els.forEach((id) => els.add(id));
    t.slides.forEach((id) => slides.add(id));
  }
  const elementIds = [...els].filter((id) => findElement(deck, id));
  let slideId = elementIds.length
    ? findElement(deck, elementIds[0]).slide.id
    : [...slides].find((id) => deck.slides[id]);
  const n = slideId ? deck.slideOrder.indexOf(slideId) + 1 : 0;
  let label = VERB[toolName] ?? toolName;
  if (toolName === 'plan_deck')
    label = `Planned ${ops.filter((o) => o.type === 'add_slide').length} slides`;
  else if (toolName === 'update_elements') label = `Edited ${ops.length} elements`;
  else if (n) label = `${label} · slide ${n}`;
  if (toolName === 'plan_deck') slideId = deck.slideOrder[0];
  return {
    label,
    slideId: slideId ?? null,
    elementIds: toolName === 'plan_deck' ? [] : elementIds,
  };
}

const nextFrame = (fn) =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16);

/**
 * @param {ReturnType<import('../store/index.js').createAppStore>} store
 * @param {{ turnId: string, onChips: (chips: object[], skipped: number) => void }} opts
 */
export function createOpApplier(store, { turnId, onChips }) {
  let queue = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    const batch = queue;
    queue = [];
    const chips = [];
    let skipped = 0;
    for (const ev of batch) {
      const res = store.getState().dispatch(ev.ops, {
        source: 'ai',
        turnId,
        label: `AI: ${VERB[ev.toolName] ?? ev.toolName}`,
      });
      if (res.ok) chips.push(chipFor(ev, store.getState().deck));
      else skipped += 1;
    }
    if (skipped) store.getState().clearError(); // the chat reports it; no toast needed
    if (chips.length || skipped) onChips(chips, skipped);
  };

  return {
    push(ev) {
      queue.push(ev);
      if (!scheduled) {
        scheduled = true;
        nextFrame(flush);
      }
    },
    /** Apply anything still queued now (end of a stream). */
    drain() {
      if (queue.length) flush();
    },
  };
}
