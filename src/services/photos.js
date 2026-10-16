/*
 * Stock photos for AI-placed images (D57, D79). The AI's add_image tool runs on the server and
 * leaves a placeholder with a search query; this browser service fills it in:
 *
 *   Wikimedia Commons (no key) → the placeholder stays
 *
 * Commons is asked anonymously: there is no key to get. It is skipped while it rests after a
 * rate-limit answer (429, or 401/403), once this browser has used its daily budget, or when it
 * errors, times out or finds nothing; the placeholder then stays and the user can replace it.
 * Requests run one at a time with a gap (lib/photos.js PHOTO_LIMITS), so a deck with many images
 * never bursts past a limit. Searches run in the visitor's browser, so each reviewer has their own
 * allowance; only the search query leaves the browser, never image data to /api.
 *
 * The picture is downloaded and stored in the deck as a data URL (≤ 1600 px, like an upload), so
 * saved decks and PPTX export don't depend on the source site later. If the host doesn't allow a
 * cross-origin download, the remote URL is kept instead (it still shows on the canvas).
 */
import {
  budgetCheck,
  budgetRest,
  budgetUse,
  parseWikimedia,
  pickPhoto,
  PHOTO_PROVIDERS,
  queryVariants,
  wikimediaUrl,
} from '../lib/photos.js';
import { MAX_IMAGE_DIM } from './images.js';

const BUDGET_KEY = 'aipb.photoBudget';
const CACHE_KEY = 'aipb.photoCache';
const CACHE_MAX = 60;
const TIMEOUT_MS = 8000;

// Per-browser bookkeeping in localStorage: a lost or blocked store only means a fresh budget.
const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? {};
  } catch {
    return {};
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: carry on without it */
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROVIDERS = {
  wikimedia: {
    url: wikimediaUrl,
    parse: parseWikimedia,
    // Wikimedia asks browser clients to identify themselves with Api-User-Agent.
    headers: { 'Api-User-Agent': 'AI-Presentation-Builder/1.0 (take-home demo)' },
  },
};

async function fetchJson(url, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const retryAfter = Number(res.headers.get('retry-after'));
    if (res.status === 429 || res.status === 401 || res.status === 403)
      return { limited: true, status: res.status, retryAfter };
    if (!res.ok) return { failed: `HTTP ${res.status}` };
    return { json: await res.json() };
  } catch (err) {
    // Network error, CORS refusal or timeout (the browser doesn't say which).
    return { failed: err?.name === 'AbortError' ? 'timeout' : 'network or CORS error' };
  } finally {
    clearTimeout(timer);
  }
}

// Every attempt is logged, so a placeholder that stays empty can be explained from the console.
const log = (...args) => console.info('[photos]', ...args);

/**
 * Find a photo for `query` on Wikimedia Commons, trying shorter forms of the query until one
 * finds something.
 * @param {string} query
 * @param {number} aspect box width / height
 * @returns {Promise<import('../lib/photos.js').PhotoCandidate | null>}
 */
export async function searchPhoto(query, aspect, { now = Date.now } = {}) {
  const key = `${query.toLowerCase().trim()}|${aspect >= 1.2 ? 'wide' : aspect <= 0.8 ? 'tall' : 'square'}`;
  const cache = readJson(CACHE_KEY);
  if (cache[key]) return cache[key];
  const variants = queryVariants(query);

  for (const name of PHOTO_PROVIDERS) {
    const p = PROVIDERS[name];
    for (const q of variants) {
      const check = budgetCheck(readJson(BUDGET_KEY), name, now());
      if (!check.ok) {
        log(name, 'skipped: resting after a rate limit, or daily budget used');
        break;
      }
      if (check.waitMs) await sleep(check.waitMs);
      writeJson(BUDGET_KEY, budgetUse(readJson(BUDGET_KEY), name, now()));

      let res = await fetchJson(p.url(q), p.headers);
      // A refused preflight for the identifying header: ask again without it.
      if (res.failed && Object.keys(p.headers).length) res = await fetchJson(p.url(q), {});
      if (res.limited) {
        log(name, `rate limited (HTTP ${res.status})`);
        writeJson(BUDGET_KEY, budgetRest(readJson(BUDGET_KEY), name, now(), res.retryAfter));
        break;
      }
      if (res.failed) {
        log(name, `"${q}": ${res.failed}`);
        break; // the service is unreachable: shorter queries won't help
      }
      const pick = pickPhoto(p.parse(res.json), aspect);
      if (!pick) {
        log(name, `"${q}": no usable results`);
        continue; // try a shorter query
      }
      log(name, `"${q}": found`, pick.src);
      const keys = Object.keys(cache);
      if (keys.length >= CACHE_MAX) delete cache[keys[0]];
      writeJson(CACHE_KEY, { ...cache, [key]: pick });
      return pick;
    }
  }
  log(`no photo for "${query}"; the placeholder stays`);
  return null;
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed'));
    img.src = src;
  });

/** Download a picture into a data URL (≤ MAX_IMAGE_DIM on its long side). Throws if the host
 *  refuses a cross-origin read. */
async function toDataUrl(url) {
  const img = await loadImage(url);
  const { naturalWidth: w, naturalHeight: h } = img;
  const k = Math.min(1, MAX_IMAGE_DIM / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85); // throws on a tainted canvas
}

/** The picture for a candidate: its full image, else its thumbnail, as data; else the URL. */
export async function loadPhoto(candidate) {
  for (const url of [candidate.src, candidate.thumb].filter(Boolean)) {
    try {
      return await toDataUrl(url);
    } catch {
      /* next */
    }
  }
  log('could not download the photo (CORS); keeping its URL', candidate.src);
  return candidate.src; // shows on the canvas; export reports it if it can't be embedded
}

const pendingImages = (deck) =>
  deck.slideOrder.flatMap((sid) =>
    deck.slides[sid].elementOrder
      .map((id) => deck.slides[sid].elements[id])
      .filter((el) => el.type === 'image' && el.query && !el.src),
  );

/**
 * Watch the deck and fill AI placeholders with photos, one at a time. Each query is tried once
 * per element per session; a placeholder that finds nothing stays as it is (the user can still
 * replace it). The result joins the AI turn's undo step when that turn is the last entry.
 * @param {ReturnType<import('../store/index.js').createAppStore>} store
 * @param {{ search?: typeof searchPhoto, load?: typeof loadPhoto }} [deps] injectable for tests
 * @returns {{ stop: () => void, idle: () => Promise<void> }}
 */
export function startPhotoFiller(store, { search = searchPhoto, load = loadPhoto } = {}) {
  const tried = new Map(); // element id → query already tried
  let running = null;

  const run = async () => {
    for (;;) {
      const next = pendingImages(store.getState().deck).find((el) => tried.get(el.id) !== el.query);
      if (!next) return;
      tried.set(next.id, next.query);
      try {
        const aspect = next.bbox.w / next.bbox.h;
        const pick = await search(next.query, aspect);
        if (!pick) continue;
        const src = await load(pick);
        // Still the same placeholder? (Deleted, replaced, undone or re-queried meanwhile: skip.)
        const s = store.getState();
        const now = pendingImages(s.deck).find((el) => el.id === next.id);
        if (!now || now.query !== next.query) continue;
        const top = s.past.at(-1);
        s.dispatch(
          {
            type: 'update_element',
            elementId: next.id,
            patch: { src, credit: pick.credit, crop: null, natural: null },
          },
          {
            source: 'ai',
            turnId: top?.source === 'ai' ? top.turnId : null,
            label: 'AI: add photo',
          },
        );
      } catch (err) {
        console.warn('Stock photo failed', err);
      }
    }
  };

  const kick = () => {
    running ??= run().finally(() => {
      running = null;
      // Something new may have arrived while the last request was finishing.
      if (pendingImages(store.getState().deck).some((el) => tried.get(el.id) !== el.query)) kick();
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
    stop: unsubscribe,
    idle: async () => {
      while (running) await running;
    },
  };
}
