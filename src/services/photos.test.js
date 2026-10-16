import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../store/index.js';
import { makeDeck } from '../lib/test-fixtures.js';
import { searchPhoto, startPhotoFiller } from './photos.js';

const ovHit = {
  results: [
    {
      url: 'https://ov.example/a.jpg',
      width: 1600,
      height: 900,
      license: 'cc0',
      title: 'Desk',
      foreign_landing_url: 'https://ov.example/a',
    },
  ],
};
const wmHit = {
  query: {
    pages: [
      {
        title: 'File:Desk.jpg',
        index: 1,
        imageinfo: [
          {
            mime: 'image/jpeg',
            url: 'https://upload.wikimedia.org/d.jpg',
            width: 1600,
            height: 900,
            extmetadata: { LicenseShortName: { value: 'CC0' } },
          },
        ],
      },
    ],
  },
};

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe('searchPhoto fallback (D57)', () => {
  let store;
  let t;
  const now = () => (t += 10_000); // well past every gap, so no real waiting
  beforeEach(() => {
    store = new Map();
    t = Date.UTC(2026, 9, 16, 10);
    vi.stubGlobal('localStorage', {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses Openverse when it answers', async () => {
    const fetch = vi.fn(async () => json(ovHit));
    vi.stubGlobal('fetch', fetch);
    const pick = await searchPhoto('desk', 16 / 9, { now });
    expect(pick.credit.source).toBe('openverse');
    expect(fetch).toHaveBeenCalledTimes(1);
    // Same query again: from the cache, no request.
    await searchPhoto('desk', 16 / 9, { now });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to Wikimedia on a 429 and rests Openverse afterwards', async () => {
    const fetch = vi.fn(async (url) =>
      String(url).includes('openverse') ? json({}, 429, { 'retry-after': '600' }) : json(wmHit),
    );
    vi.stubGlobal('fetch', fetch);
    const first = await searchPhoto('meeting', 16 / 9, { now });
    expect(first.credit.source).toBe('wikimedia');
    expect(fetch).toHaveBeenCalledTimes(2);
    // Openverse is resting: the next search goes straight to Wikimedia.
    const second = await searchPhoto('office', 16 / 9, { now });
    expect(second.credit.source).toBe('wikimedia');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(String(fetch.mock.calls[2][0])).toContain('wikimedia');
  });

  it('falls back on errors and empty results, and returns null when nothing is found', async () => {
    const fetch = vi.fn(async (url) => {
      if (String(url).includes('openverse')) throw new TypeError('network');
      return json({ query: { pages: [] } });
    });
    vi.stubGlobal('fetch', fetch);
    expect(await searchPhoto('nothing', 1, { now })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('tries shorter forms of a long query before moving on', async () => {
    const fetch = vi.fn(async (url) => {
      const q = new URL(url).searchParams.get('q');
      return json(q === 'composting facility' ? ovHit : { results: [] });
    });
    vi.stubGlobal('fetch', fetch);
    const pick = await searchPhoto('composting facility with residents sorting waste', 16 / 9, {
      now,
    });
    expect(pick.credit.source).toBe('openverse');
    expect(fetch.mock.calls.map(([u]) => new URL(u).searchParams.get('q'))).toEqual([
      'composting facility residents sorting waste',
      'composting facility residents sorting',
      'composting facility residents',
      'composting facility',
    ]);
  });

  it('skips a provider that has used its daily budget', async () => {
    store.set(
      'aipb.photoBudget',
      JSON.stringify({ openverse: { day: '2026-10-16', used: 150, last: 0, restUntil: 0 } }),
    );
    const fetch = vi.fn(async () => json(wmHit));
    vi.stubGlobal('fetch', fetch);
    const pick = await searchPhoto('chart', 16 / 9, { now });
    expect(pick.credit.source).toBe('wikimedia');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('startPhotoFiller (D57)', () => {
  const candidate = {
    src: 'https://ov.example/a.jpg',
    width: 1600,
    height: 900,
    credit: { text: '"Desk" (CC0)', license: 'CC0', source: 'openverse' },
  };
  const addPlaceholder = (store, turnId = 't_1') =>
    store.getState().dispatch(
      {
        type: 'add_element',
        slideId: 's_ccccc',
        element: {
          id: 'el_photo',
          type: 'image',
          src: '',
          alt: 'A desk',
          fit: 'cover',
          query: 'desk',
          bbox: { x: 100, y: 300, w: 800, h: 450 },
        },
      },
      { source: 'ai', turnId, label: 'AI: add image' },
    );

  it('fills an AI placeholder with the photo and its credit, in the same undo step', async () => {
    const store = createAppStore(makeDeck());
    addPlaceholder(store);
    const search = vi.fn(async () => candidate);
    const filler = startPhotoFiller(store, {
      search,
      load: async () => 'data:image/jpeg;base64,AA',
    });
    await filler.idle();
    const el = store.getState().deck.slides.s_ccccc.elements.el_photo;
    expect(el.src).toBe('data:image/jpeg;base64,AA');
    expect(el.credit.source).toBe('openverse');
    expect(search).toHaveBeenCalledWith('desk', 800 / 450);
    expect(store.getState().past).toHaveLength(1); // joined the AI turn
    store.getState().undo();
    expect(store.getState().deck.slides.s_ccccc.elements.el_photo).toBeUndefined();
    filler.stop();
  });

  it('leaves the placeholder when nothing is found, and tries each query once', async () => {
    const store = createAppStore(makeDeck());
    addPlaceholder(store);
    const search = vi.fn(async () => null);
    const filler = startPhotoFiller(store, { search, load: async () => 'x' });
    await filler.idle();
    store.getState().dispatch({
      type: 'update_element',
      elementId: 'el_photo',
      patch: { alt: 'Still a desk' },
    });
    await filler.idle();
    expect(search).toHaveBeenCalledTimes(1);
    expect(store.getState().deck.slides.s_ccccc.elements.el_photo.src).toBe('');
    filler.stop();
  });

  it('does not overwrite an image the user replaced while the search ran', async () => {
    const store = createAppStore(makeDeck());
    addPlaceholder(store);
    let release;
    const search = vi.fn(
      () =>
        new Promise((r) => {
          release = () => r(candidate);
        }),
    );
    const filler = startPhotoFiller(store, {
      search,
      load: async () => 'data:image/jpeg;base64,AA',
    });
    await vi.waitFor(() => expect(search).toHaveBeenCalled());
    store.getState().dispatch({
      type: 'update_element',
      elementId: 'el_photo',
      patch: { src: 'data:image/png;base64,USER' },
    });
    release();
    await filler.idle();
    expect(store.getState().deck.slides.s_ccccc.elements.el_photo.src).toBe(
      'data:image/png;base64,USER',
    );
    filler.stop();
  });
});
