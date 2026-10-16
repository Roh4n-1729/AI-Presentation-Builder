/*
 * Image descriptions (D58). Chat models can't see pictures, so each picture in the deck is
 * described once: a ≤ 768 px JPEG copy goes to /api/describe (Gemini), and the short text that
 * comes back is stored on the element with the fingerprint of the picture it describes. Every
 * later AI turn reads it in the deck context, so Sarvam stays the chat model.
 *
 * Runs in the background, one picture at a time. The description is stored without an undo step
 * (`record: false`): it isn't an edit the user made. Pictures whose host refuses a cross-origin
 * read can't be copied and stay undescribed; without a Gemini key the service stops for the
 * session. Each picture is tried once per session.
 */
import { needsDescription, srcFingerprint } from '../lib/imageInfo.js';

const MAX_DIM = 768;

const log = (...args) => console.info('[describe]', ...args);

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });

/** A small JPEG copy of the picture (white behind transparency), as a data URL. */
export async function shrinkForVision(src) {
  const img = await loadImage(src);
  const w = img.naturalWidth || 800;
  const h = img.naturalHeight || 600;
  const k = Math.min(1, MAX_DIM / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8); // throws on a tainted canvas (no CORS)
}

/**
 * @returns {Promise<{ description: string } | { stop: true } | { retryAfter: number } | null>}
 */
export async function requestDescription(image, alt) {
  const res = await fetch('/api/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, ...(alt ? { alt: alt.slice(0, 300) } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.description) return { description: body.description };
  if (res.status === 503) return { stop: true, message: body.message };
  if (res.status === 429) return { retryAfter: Number(res.headers.get('retry-after')) || 30 };
  log('failed:', body.message ?? `HTTP ${res.status}`);
  return null;
}

const imagesNeedingText = (deck) =>
  deck.slideOrder.flatMap((sid) =>
    deck.slides[sid].elementOrder
      .map((id) => deck.slides[sid].elements[id])
      .filter(needsDescription),
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {ReturnType<import('../store/index.js').createAppStore>} store
 * @param {{ shrink?: typeof shrinkForVision, describe?: typeof requestDescription }} [deps]
 * @returns {{ stop: () => void, idle: () => Promise<void> }}
 */
export function startCaptioner(
  store,
  { shrink = shrinkForVision, describe = requestDescription } = {},
) {
  const tried = new Map(); // element id → fingerprint already tried
  let stopped = false;
  let running = null;

  const pending = () =>
    stopped
      ? []
      : imagesNeedingText(store.getState().deck).filter(
          (el) => tried.get(el.id) !== srcFingerprint(el.src),
        );

  const run = async () => {
    for (;;) {
      const el = pending()[0];
      if (!el) return;
      const of = srcFingerprint(el.src);
      tried.set(el.id, of);
      let image;
      try {
        image = await shrink(el.src);
      } catch {
        log(`can't copy ${el.id} (the host doesn't allow it); not described`);
        continue;
      }
      let res;
      try {
        res = await describe(image, el.alt);
      } catch (err) {
        log('request failed', err);
        continue;
      }
      if (res?.stop) {
        log(res.message ?? 'not available; stopping');
        stopped = true;
        return;
      }
      if (res?.retryAfter) {
        tried.delete(el.id); // try this one again after the wait
        await sleep(res.retryAfter * 1000);
        continue;
      }
      if (!res?.description) continue;
      // Still the same picture? (Replaced, deleted or undone meanwhile: skip.)
      const now = imagesNeedingText(store.getState().deck).find((e) => e.id === el.id);
      if (!now || srcFingerprint(now.src) !== of) continue;
      store.getState().dispatch(
        {
          type: 'update_element',
          elementId: el.id,
          patch: { description: { text: res.description, of } },
        },
        { record: false, label: 'Describe image' },
      );
    }
  };

  const kick = () => {
    if (running || stopped) return;
    running = run().finally(() => {
      running = null;
      if (pending().length) kick();
    });
  };

  let lastDeck = null;
  const unsubscribe = store.subscribe((s) => {
    if (s.deck === lastDeck) return;
    lastDeck = s.deck;
    kick();
  });
  kick();
  return {
    stop: () => {
      stopped = true;
      unsubscribe();
    },
    idle: async () => {
      while (running) await running;
    },
  };
}
