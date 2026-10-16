import { describe, expect, it } from 'vitest';
import {
  budgetCheck,
  budgetRest,
  budgetUse,
  openverseUrl,
  parseOpenverse,
  parseWikimedia,
  pickPhoto,
  queryVariants,
  wikimediaUrl,
} from './photos.js';

const ov = {
  result_count: 3,
  results: [
    {
      id: 'a',
      title: 'Team at whiteboard',
      url: 'https://live.staticflickr.com/a.jpg',
      thumbnail: 'https://api.openverse.org/v1/images/a/thumb/',
      width: 1200,
      height: 800,
      license: 'by',
      license_version: '2.0',
      creator: 'Jane',
      attribution: '"Team at whiteboard" by Jane is licensed under CC BY 2.0.',
      foreign_landing_url: 'https://flickr.com/photos/a',
      filetype: 'jpg',
      mature: false,
    },
    { id: 'b', url: 'https://x/b.jpg', license: 'by-sa', width: 1000, height: 1000 },
    { id: 'c', url: 'https://x/c.svg', license: 'cc0', filetype: 'svg', width: 10, height: 10 },
  ],
};

const wm = {
  query: {
    pages: [
      {
        title: 'File:Office meeting.jpg',
        index: 2,
        imageinfo: [
          {
            mime: 'image/jpeg',
            url: 'https://upload.wikimedia.org/o.jpg',
            thumburl: 'https://upload.wikimedia.org/1600px-o.jpg',
            thumbwidth: 1600,
            thumbheight: 900,
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Office_meeting.jpg',
            extmetadata: {
              LicenseShortName: { value: 'CC BY 4.0' },
              Artist: { value: '<a href="//x">Ann Lee</a>' },
              ObjectName: { value: 'Office meeting' },
            },
          },
        ],
      },
      {
        title: 'File:Share.jpg',
        index: 1,
        imageinfo: [
          {
            mime: 'image/jpeg',
            url: 'https://upload.wikimedia.org/s.jpg',
            extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
          },
        ],
      },
    ],
  },
};

describe('photo sources (D57)', () => {
  it('builds keyless search URLs with the licence filter', () => {
    expect(openverseUrl('team planning')).toContain('license=cc0%2Cpdm%2Cby');
    expect(openverseUrl('x')).toContain('page_size=12');
    const w = wikimediaUrl('team planning');
    expect(w).toContain('origin=*');
    expect(w).toContain('filetype%3Abitmap');
  });

  it('keeps only CC0 / PDM / CC BY raster results from Openverse, with credit', () => {
    const c = parseOpenverse(ov);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ src: 'https://live.staticflickr.com/a.jpg', width: 1200 });
    expect(c[0].credit).toMatchObject({
      license: 'CC BY 2.0',
      source: 'openverse',
      url: 'https://flickr.com/photos/a',
    });
    expect(c[0].credit.text).toContain('Jane');
    expect(parseOpenverse(null)).toEqual([]);
  });

  it('keeps allowed Commons files, strips HTML from the artist, drops share-alike', () => {
    const c = parseWikimedia(wm);
    expect(c).toHaveLength(1);
    expect(c[0].src).toContain('1600px');
    expect(c[0].credit.text).toBe('"Office meeting" by Ann Lee (CC BY 4.0)');
    expect(parseWikimedia({})).toEqual([]);
  });

  it('picks the candidate closest to the box shape, avoiding tiny images', () => {
    const wide = { src: 'w', width: 1600, height: 900, credit: {} };
    const square = { src: 's', width: 1000, height: 1000, credit: {} };
    const tinyWide = { src: 't', width: 320, height: 180, credit: {} };
    expect(pickPhoto([square, wide], 16 / 9).src).toBe('w');
    expect(pickPhoto([wide, square], 1).src).toBe('s');
    expect(pickPhoto([tinyWide, square], 16 / 9).src).toBe('s');
    expect(pickPhoto([], 1)).toBeNull();
  });

  it('spaces requests, stops at the daily budget and rests after a 429', () => {
    const t0 = Date.UTC(2026, 9, 16, 10);
    let b = {};
    expect(budgetCheck(b, 'openverse', t0)).toEqual({ ok: true, waitMs: 0 });
    b = budgetUse(b, 'openverse', t0);
    expect(budgetCheck(b, 'openverse', t0 + 1000).waitMs).toBe(2500);
    b = budgetRest(b, 'openverse', t0, 60);
    expect(budgetCheck(b, 'openverse', t0 + 30_000).ok).toBe(false);
    expect(budgetCheck(b, 'openverse', t0 + 61_000).ok).toBe(true);
    b = { openverse: { day: '2026-10-16', used: 150, last: 0, restUntil: 0 } };
    expect(budgetCheck(b, 'openverse', t0).ok).toBe(false);
    expect(budgetCheck(b, 'openverse', t0 + 24 * 3600_000).ok).toBe(true); // a new day
    expect(budgetCheck(b, 'wikimedia', t0).ok).toBe(true);
  });
});

describe('queryVariants (D57)', () => {
  it('shortens sentence-like queries, most specific first', () => {
    expect(
      queryVariants(
        'community composting facility with residents sorting organic waste Pune India',
      ),
    ).toEqual([
      'community composting facility residents',
      'community composting facility',
      'community composting',
    ]);
    expect(queryVariants('team planning whiteboard')).toEqual([
      'team planning whiteboard',
      'team planning',
    ]);
    expect(queryVariants('solar')).toEqual(['solar']);
    expect(queryVariants('Pune, India!')).toEqual(['pune india']);
  });
});
