import { describe, expect, it } from 'vitest';
import { copyPayload, payloadText, pasteOps, readPayload } from './clipboard.js';
import { applyOps } from './ops/index.js';
import { DeckSchema } from './schema/index.js';
import { makeDeck } from './test-fixtures.js';

let n = 0;
const mint = { element: () => `el_new${++n}`, group: () => `g_new${++n}` };

describe('copy / paste elements (D53)', () => {
  it('copies in z-order, round-trips through JSON, and gives other apps plain text', () => {
    const deck = makeDeck();
    const slide = deck.slides.s_aaaaa;
    const ids = [...slide.elementOrder].reverse();
    const p = copyPayload(deck, 's_aaaaa', ids);
    expect(p.elements.map((e) => e.id)).toEqual(slide.elementOrder);
    expect(readPayload(JSON.stringify(p))).toEqual(p);
    expect(readPayload('just text')).toBeNull();
    expect(payloadText(p)).toContain('Q3 Roadmap');
  });

  it('pastes with fresh ids, steps on repeat, and the deck stays valid', () => {
    const deck = makeDeck();
    const p = copyPayload(deck, 's_aaaaa', ['el_title']);
    const { ops, ids } = pasteOps(p, 's_aaaaa', 1, mint);
    const next = structuredClone(deck);
    applyOps(next, ops); // mutates (the store runs it on an Immer draft)
    const pasted = next.slides.s_aaaaa.elements[ids[0]];
    const src = deck.slides.s_aaaaa.elements.el_title;
    expect(pasted.bbox.x).toBe(src.bbox.x + 40);
    expect(pasted.slot).toBeUndefined();
    expect(DeckSchema.safeParse(next).success).toBe(true);
    // Another slide, first paste: same position.
    const other = pasteOps(p, 's_ccccc', 0, mint);
    const copy = structuredClone(deck);
    applyOps(copy, other.ops);
    const there = copy.slides.s_ccccc.elements[other.ids[0]];
    expect(there.bbox).toEqual(src.bbox);
  });

  it('copied groups paste as a new group, never joining the original', () => {
    const deck = makeDeck();
    const slide = deck.slides.s_bbbbb;
    const [a, b] = slide.elementOrder;
    slide.elements[a].groupId = 'g_orig1';
    slide.elements[b].groupId = 'g_orig1';
    const { ops } = pasteOps(copyPayload(deck, 's_bbbbb', [a, b]), 's_bbbbb', 1, mint);
    const gids = ops.map((o) => o.element.groupId);
    expect(gids[0]).toBe(gids[1]);
    expect(gids[0]).not.toBe('g_orig1');
  });
});
