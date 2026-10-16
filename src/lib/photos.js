/**
 * Stock photos for AI-placed images (D57): pure helpers, no fetch. The browser service
 * (services/photos.js) asks Openverse first and Wikimedia Commons second; both need no API key.
 * Only licences that allow any use with at most a credit line are accepted: CC0, Public Domain
 * Mark and CC BY. Share-alike, non-commercial and no-derivatives licences are skipped, so a deck
 * can be edited, cropped and shared without conditions beyond the credit.
 */

/** @typedef {{ text: string, url?: string, license: string, source: 'openverse' | 'wikimedia' }} PhotoCredit */
/** @typedef {{ src: string, thumb?: string, width: number, height: number, credit: PhotoCredit }} PhotoCandidate */

export const PHOTO_PROVIDERS = ['openverse', 'wikimedia'];

/**
 * Self-imposed limits, kept under each provider's own so a burst of image tools never trips them.
 * Openverse allows anonymous clients about 20 requests a minute and 200 a day; Wikimedia allows
 * about 200 a minute for identified clients. `gapMs` spaces requests; `perDay` is the budget per
 * browser. After a 429 the provider rests for Retry-After (or `restMs`).
 */
export const PHOTO_LIMITS = {
  openverse: { gapMs: 3500, perDay: 150, restMs: 10 * 60_000 },
  wikimedia: { gapMs: 500, perDay: 1000, restMs: 5 * 60_000 },
};

const clean = (s, max = 120) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, '') // Wikimedia's Artist is HTML
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// ---------------------------------------------------------------- queries

const STOP = new Set(
  'a an the of and or with for in on at to by from into over under near its their our your this that these those showing shows people person'.split(
    ' ',
  ),
);

/**
 * Search terms to try, most specific first. Photo searches match every word, so a long,
 * sentence-like query ("community composting facility with residents sorting organic waste Pune
 * India") finds nothing; shorter forms of it usually do. Drops filler words, then tries the first
 * four, three and two remaining words (the head of the phrase comes first in AI queries).
 * @param {string} query
 * @returns {string[]}
 */
export function queryVariants(query) {
  const words = String(query ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  const out = [];
  for (const n of [words.length, 4, 3, 2]) {
    const q = words.slice(0, Math.min(n, words.length)).join(' ');
    if (q && !out.includes(q) && (n <= 4 || words.length <= 5)) out.push(q);
  }
  return out;
}

// ---------------------------------------------------------------- Openverse

/** Search URL: the licence filter is applied by Openverse itself. */
export function openverseUrl(query) {
  const p = new URLSearchParams({
    q: query,
    license: 'cc0,pdm,by',
    mature: 'false',
    page_size: '12', // anonymous clients may ask for at most 20
  });
  return `https://api.openverse.org/v1/images/?${p}`;
}

const OV_LICENSE = { cc0: 'CC0', pdm: 'Public domain', by: 'CC BY' };

/** Openverse response → candidates (allowed licences, raster images only). */
export function parseOpenverse(json) {
  const results = Array.isArray(json?.results) ? json.results : [];
  return results
    .filter((r) => r && typeof r.url === 'string' && OV_LICENSE[r.license])
    .filter((r) => !r.mature && !/svg|gif/i.test(r.filetype ?? ''))
    .map((r) => {
      const license = [OV_LICENSE[r.license], r.license === 'by' ? r.license_version : '']
        .filter(Boolean)
        .join(' ');
      const by = clean(r.creator, 60);
      const title = clean(r.title, 80);
      return {
        src: r.url,
        thumb: typeof r.thumbnail === 'string' ? r.thumbnail : undefined,
        width: Number(r.width) || 0,
        height: Number(r.height) || 0,
        credit: {
          // Openverse's own attribution line when it sends one, else built from the parts.
          text:
            clean(r.attribution, 300) ||
            [title ? `"${title}"` : 'Photo', by && `by ${by}`, license && `(${license})`]
              .filter(Boolean)
              .join(' '),
          url: r.foreign_landing_url || undefined,
          license,
          source: 'openverse',
        },
      };
    });
}

// ---------------------------------------------------------------- Wikimedia Commons

/** File search on Commons with image info (a 1600 px rendition and licence metadata). */
export function wikimediaUrl(query) {
  const p = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*', // anonymous CORS
    generator: 'search',
    gsrnamespace: '6', // File:
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600',
    iiextmetadatafilter: 'LicenseShortName|Artist|ObjectName',
  });
  return `https://commons.wikimedia.org/w/api.php?${p}`;
}

// "CC0", "Public domain", "CC BY 4.0", "CC-BY-2.0"; not SA / NC / ND variants.
const WM_ALLOWED = /^(cc0( 1\.0)?|public domain|pdm|cc[ -]by([ -]\d(\.\d)?)?)$/i;

/** Commons response → candidates, in search-rank order, allowed licences only. */
export function parseWikimedia(json) {
  const pages = Array.isArray(json?.query?.pages) ? json.query.pages : [];
  return [...pages]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((page) => {
      const info = page?.imageinfo?.[0];
      if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? '')) return [];
      const meta = info.extmetadata ?? {};
      const license = clean(meta.LicenseShortName?.value, 40);
      if (!WM_ALLOWED.test(license)) return [];
      const by = clean(meta.Artist?.value, 60);
      const title = clean(meta.ObjectName?.value || page.title?.replace(/^File:|\.\w+$/g, ''), 80);
      return [
        {
          src: info.thumburl || info.url,
          width: Number(info.thumbwidth || info.width) || 0,
          height: Number(info.thumbheight || info.height) || 0,
          credit: {
            text: [title ? `"${title}"` : 'Photo', by && `by ${by}`, `(${license})`]
              .filter(Boolean)
              .join(' '),
            url: info.descriptionurl || undefined,
            license,
            source: 'wikimedia',
          },
        },
      ];
    });
}

// ---------------------------------------------------------------- choosing

/**
 * The candidate that best fits a box: closest aspect ratio (the image is shown "cover", so a
 * close shape crops least), with small images (under 640 px wide) pushed back. Ties keep the
 * provider's ranking.
 * @param {PhotoCandidate[]} candidates
 * @param {number} aspect  box width / height
 */
export function pickPhoto(candidates, aspect) {
  const want = Math.log(aspect > 0 ? aspect : 16 / 9);
  let best = null;
  let bestScore = Infinity;
  candidates.forEach((c, rank) => {
    const a = c.width > 0 && c.height > 0 ? c.width / c.height : 1.5;
    const score = Math.abs(Math.log(a) - want) + (c.width && c.width < 640 ? 1 : 0) + rank * 0.02;
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  });
  return best;
}

// ---------------------------------------------------------------- budget

/** @typedef {Record<string, { day: string, used: number, last: number, restUntil: number }>} PhotoBudget */

const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const entry = (budget, provider, now) => {
  const e = budget?.[provider];
  return e && e.day === dayOf(now) ? e : { day: dayOf(now), used: 0, last: 0, restUntil: 0 };
};

/**
 * May `provider` be asked now? Returns `{ ok: true, waitMs }` (wait that long to respect the gap)
 * or `{ ok: false }` when it is resting after a 429 or has used today's budget.
 */
export function budgetCheck(budget, provider, now) {
  const lim = PHOTO_LIMITS[provider];
  const e = entry(budget, provider, now);
  if (e.restUntil > now || e.used >= lim.perDay) return { ok: false };
  return { ok: true, waitMs: Math.max(0, e.last + lim.gapMs - now) };
}

/** Record one request. Returns a new budget. */
export function budgetUse(budget, provider, now) {
  const e = entry(budget, provider, now);
  return { ...budget, [provider]: { ...e, used: e.used + 1, last: now } };
}

/** Record a rate-limit answer: rest for Retry-After seconds, or the provider's default. */
export function budgetRest(budget, provider, now, retryAfterSec) {
  const e = entry(budget, provider, now);
  const ms =
    Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? Math.min(retryAfterSec * 1000, 24 * 3600_000)
      : PHOTO_LIMITS[provider].restMs;
  return { ...budget, [provider]: { ...e, restUntil: now + ms } };
}
