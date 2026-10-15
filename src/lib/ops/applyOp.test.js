import { applyPatches, enablePatches, produce, produceWithPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { createSlide } from '../factories.js';
import { makeDeck, text } from '../test-fixtures.js';
import { applyOp, applyOps, findElement, OpError } from './index.js';

enablePatches();

/** Apply ops the way the store does (Immer draft) and return the next deck. */
const run = (deck, ...ops) => produce(deck, (d) => applyOps(d, ops));
const code = (fn) => {
  try {
    fn();
  } catch (e) {
    return e instanceof OpError ? e.code : `not an OpError: ${e.message}`;
  }
  return 'no error';
};

describe('slides: id-anchored positions (D24)', () => {
  const deck = makeDeck(); // [a, b, c]
  const add = (id, afterSlideId) => ({
    type: 'add_slide',
    slide: createSlide({ id }),
    afterSlideId,
  });

  it('add_slide: omitted = last, null = first, id = after it, unknown anchor = last', () => {
    expect(run(deck, add('s_new01')).slideOrder.at(-1)).toBe('s_new01');
    expect(run(deck, add('s_new01', null)).slideOrder[0]).toBe('s_new01');
    expect(run(deck, add('s_new01', 's_aaaaa')).slideOrder).toEqual([
      's_aaaaa',
      's_new01',
      's_bbbbb',
      's_ccccc',
    ]);
    expect(run(deck, add('s_new01', 's_gone1')).slideOrder.at(-1)).toBe('s_new01');
  });

  it('reorder_slides lands the same on two copies that diverged', () => {
    // The server's working copy still has [a, b, c]; meanwhile the user dragged b to the front.
    const server = deck;
    const client = run(deck, { type: 'reorder_slides', slideId: 's_bbbbb', afterSlideId: null });
    expect(client.slideOrder).toEqual(['s_bbbbb', 's_aaaaa', 's_ccccc']);

    // AI: "move the last slide right after the intro". Index-based (from 2 to 1) would put it
    // after b on the client; the anchor puts it after a on both copies.
    const op = { type: 'reorder_slides', slideId: 's_ccccc', afterSlideId: 's_aaaaa' };
    const after = (d) => d.slideOrder[d.slideOrder.indexOf('s_aaaaa') + 1];
    expect(after(run(server, op))).toBe('s_ccccc');
    expect(after(run(client, op))).toBe('s_ccccc');
  });

  it('reorder after itself is a no-op; unknown slide is NOT_FOUND', () => {
    const op = { type: 'reorder_slides', slideId: 's_bbbbb', afterSlideId: 's_bbbbb' };
    expect(run(deck, op)).toBe(deck); // Immer returns the same object when nothing changed
    expect(code(() => run(deck, { type: 'delete_slide', slideId: 's_nope1' }))).toBe('NOT_FOUND');
  });

  it('update_slide merges background and keeps the rest', () => {
    const next = run(deck, {
      type: 'update_slide',
      slideId: 's_bbbbb',
      patch: { title: 'Revenue is growing', background: { color: 'surface' } },
    });
    expect(next.slides.s_bbbbb.title).toBe('Revenue is growing');
    expect(next.slides.s_bbbbb.background).toEqual({ color: 'surface' });
    expect(next.slides.s_bbbbb.elementOrder).toEqual(['el_chart', 'el_body']);
  });

  it('duplicate_slide copies from this deck, uses idMap, derives missing ids, lands after source', () => {
    const next = run(deck, {
      type: 'duplicate_slide',
      slideId: 's_bbbbb',
      newSlideId: 's_dup01',
      idMap: { el_chart: 'el_chart2' },
    });
    expect(next.slideOrder).toEqual(['s_aaaaa', 's_bbbbb', 's_dup01', 's_ccccc']);
    expect(next.slides.s_dup01.elementOrder).toEqual(['el_chart2', 'el_body_dup01']);
    expect(next.slides.s_dup01.elements.el_chart2.chart).toEqual(
      deck.slides.s_bbbbb.elements.el_chart.chart,
    );
    // deep copy: editing the copy leaves the original alone
    const edited = run(next, {
      type: 'update_element',
      elementId: 'el_chart2',
      patch: { chart: { title: 'Copy' } },
    });
    expect(edited.slides.s_bbbbb.elements.el_chart.chart.title).toBe('Quarterly revenue');
  });

  it('refuses ids that already exist', () => {
    expect(code(() => run(deck, add('s_aaaaa')))).toBe('CONFLICT');
    expect(
      code(() =>
        run(deck, {
          type: 'duplicate_slide',
          slideId: 's_aaaaa',
          newSlideId: 's_dup01',
          idMap: { el_title: 'el_body' },
        }),
      ),
    ).toBe('CONFLICT');
  });

  it('delete_slide removes it from map and order', () => {
    const next = run(deck, { type: 'delete_slide', slideId: 's_bbbbb' });
    expect(next.slideOrder).toEqual(['s_aaaaa', 's_ccccc']);
    expect(next.slides.s_bbbbb).toBeUndefined();
  });

  it('update_deck sets title and theme', () => {
    const next = run(deck, {
      type: 'update_deck',
      patch: { title: 'Board update', theme: 'paper' },
    });
    expect(next.title).toBe('Board update');
  });
});

describe('elements', () => {
  const deck = makeDeck();

  it('add_element validates, fills defaults, clamps, and goes on top', () => {
    const next = run(deck, {
      type: 'add_element',
      slideId: 's_ccccc',
      element: { ...text('el_new01'), bbox: { x: 1800, y: -50, w: 4000, h: 300 } },
    });
    const el = next.slides.s_ccccc.elements.el_new01;
    expect(el.bbox).toEqual({ x: 80, y: 0, w: 1840, h: 300 }); // shrunk to leave the margin, pushed inside
    expect(next.slides.s_ccccc.elementOrder.at(-1)).toBe('el_new01');
    expect(
      code(() => run(deck, { type: 'add_element', slideId: 's_ccccc', element: text('el_body') })),
    ).toBe('CONFLICT');
    expect(
      code(() =>
        run(deck, {
          type: 'add_element',
          slideId: 's_ccccc',
          element: { ...text('el_x1y2z'), paragraphs: [] },
        }),
      ),
    ).toBe('INVALID');
  });

  it('update_element merges one level deep: chart type changes keep the data', () => {
    const next = run(deck, {
      type: 'update_element',
      elementId: 'el_chart',
      patch: { chart: { kind: 'line' } },
    });
    const chart = next.slides.s_bbbbb.elements.el_chart.chart;
    expect(chart.kind).toBe('line');
    expect(chart.series[0].values).toEqual([10, 12, 15, 18]);
    expect(chart.title).toBe('Quarterly revenue');
  });

  it('update_element rejects invalid results with a message the model can act on', () => {
    let msg = '';
    try {
      run(deck, {
        type: 'update_element',
        elementId: 'el_chart',
        patch: { chart: { categories: ['Q1', 'Q2'] } },
      });
    } catch (e) {
      msg = e.message;
    }
    expect(msg).toContain('one value per category');
    expect(
      code(() =>
        run(deck, { type: 'update_element', elementId: 'el_chart', patch: { type: 'text' } }),
      ),
    ).toBe('INVALID');
  });

  it('a bbox patch (resize) clears the layout slot; a text patch keeps it', () => {
    const resized = run(deck, {
      type: 'update_element',
      elementId: 'el_body',
      patch: { bbox: { w: 500 } },
    });
    expect(resized.slides.s_bbbbb.elements.el_body.slot).toBeUndefined();
    expect(resized.slides.s_bbbbb.elements.el_body.bbox).toEqual({
      x: 1260,
      y: 270,
      w: 500,
      h: 700,
    });

    const edited = run(deck, {
      type: 'update_element',
      elementId: 'el_body',
      patch: { paragraphs: [{ text: 'Shorter' }] },
    });
    expect(edited.slides.s_bbbbb.elements.el_body.slot).toBe('body');
  });

  it('locked elements refuse edits, moves and deletes, but can be unlocked', () => {
    const locked = run(deck, {
      type: 'update_element',
      elementId: 'el_chart',
      patch: { locked: true },
    });
    const box = { x: 0, y: 0, w: 100, h: 100 };
    expect(
      code(() => run(locked, { type: 'move_element', elementId: 'el_chart', bbox: box })),
    ).toBe('LOCKED');
    expect(code(() => run(locked, { type: 'delete_element', elementId: 'el_chart' }))).toBe(
      'LOCKED',
    );
    expect(
      code(() =>
        run(locked, {
          type: 'update_element',
          elementId: 'el_chart',
          patch: { chart: { kind: 'pie' } },
        }),
      ),
    ).toBe('LOCKED');
    const unlocked = run(locked, {
      type: 'update_element',
      elementId: 'el_chart',
      patch: { locked: false },
    });
    expect(unlocked.slides.s_bbbbb.elements.el_chart.locked).toBe(false);
  });

  it('move_element on the same slide sets the box and clears the slot', () => {
    const next = run(deck, {
      type: 'move_element',
      elementId: 'el_chart',
      bbox: { x: 300, y: 300, w: 1100, h: 740 },
    });
    const el = next.slides.s_bbbbb.elements.el_chart;
    expect(el.bbox.x).toBe(300);
    expect(el.slot).toBeUndefined();
  });

  it('move_element to another slide re-parents; the next lookup finds it there', () => {
    const next = run(deck, {
      type: 'move_element',
      elementId: 'el_chart',
      toSlideId: 's_aaaaa',
      bbox: { x: 96, y: 250, w: 1100, h: 740 },
    });
    expect(next.slides.s_bbbbb.elementOrder).toEqual(['el_body']);
    expect(next.slides.s_aaaaa.elementOrder).toEqual(['el_title', 'el_chart']);
    expect(findElement(next, 'el_chart').slide.id).toBe('s_aaaaa');
  });

  it('move_element with newId copies (Alt-drag / duplicate) and keeps the original', () => {
    const next = run(deck, {
      type: 'move_element',
      elementId: 'el_chart',
      toSlideId: 's_ccccc',
      newId: 'el_copy1',
      bbox: { x: 40, y: 40, w: 1100, h: 740 },
    });
    expect(next.slides.s_bbbbb.elements.el_chart).toBeDefined();
    expect(next.slides.s_ccccc.elements.el_copy1.chart.categories).toEqual([
      'Q1',
      'Q2',
      'Q3',
      'Q4',
    ]);
  });

  it('a huge element dropped on a slide is clamped inside the artboard, not rejected', () => {
    const next = run(deck, {
      type: 'move_element',
      elementId: 'el_chart',
      toSlideId: 's_aaaaa',
      bbox: { x: 1500, y: 900, w: 3000, h: 2000 },
    });
    const box = next.slides.s_aaaaa.elements.el_chart.bbox;
    expect(box).toEqual({ x: 80, y: 80, w: 1840, h: 1000 });
    expect(box.x >= 0 && box.y >= 0 && box.x + box.w <= 1920 && box.y + box.h <= 1080).toBe(true);
  });

  it('reorder_elements changes z-order only', () => {
    const next = run(deck, { type: 'reorder_elements', elementId: 'el_chart', direction: 'front' });
    expect(next.slides.s_bbbbb.elementOrder).toEqual(['el_body', 'el_chart']);
    expect(
      run(next, { type: 'reorder_elements', elementId: 'el_chart', direction: 'forward' }),
    ).toBe(next);
  });

  it('delete_element removes it; a missing target is NOT_FOUND (user deleted it mid-stream)', () => {
    const next = run(deck, { type: 'delete_element', elementId: 'el_body' });
    expect(findElement(next, 'el_body')).toBeNull();
    expect(code(() => run(next, { type: 'update_element', elementId: 'el_body', patch: {} }))).toBe(
      'NOT_FOUND',
    );
  });

  it('change_layout applies placements only to elements still in a slot', () => {
    const handPlaced = run(deck, {
      type: 'move_element',
      elementId: 'el_body',
      bbox: { x: 1300, y: 300, w: 500, h: 600 },
    });
    const next = run(handPlaced, {
      type: 'change_layout',
      slideId: 's_bbbbb',
      layout: 'two-column',
      placements: {
        el_chart: { bbox: { x: 984, y: 260, w: 840, h: 720 }, slot: 'right' },
        el_body: { bbox: { x: 96, y: 260, w: 840, h: 720 }, slot: 'left' }, // stale: now hand-placed
      },
    });
    const s = next.slides.s_bbbbb;
    expect(s.layout).toBe('two-column');
    expect(s.elements.el_chart).toMatchObject({ slot: 'right', bbox: { x: 984 } });
    expect(s.elements.el_body.bbox.x).toBe(1300); // untouched
  });
});

describe('ops are validated and deterministic', () => {
  it('malformed ops are INVALID, not crashes', () => {
    const deck = makeDeck();
    expect(code(() => applyOp(deck, { type: 'explode' }))).toBe('INVALID');
    expect(code(() => applyOp(deck, { type: 'move_element', elementId: 'el_chart' }))).toBe(
      'INVALID',
    );
  });

  it('the same op gives the same result on two independent copies', () => {
    const op = {
      type: 'duplicate_slide',
      slideId: 's_bbbbb',
      newSlideId: 's_dup01',
    };
    expect(run(makeDeck(), op)).toEqual(run(makeDeck(), op));
  });
});

describe('Immer patches (undo)', () => {
  it('inverse patches restore the deck exactly', () => {
    const deck = makeDeck();
    const [next, , inverse] = produceWithPatches(deck, (d) =>
      applyOps(d, [
        {
          type: 'move_element',
          elementId: 'el_chart',
          toSlideId: 's_ccccc',
          bbox: { x: 40, y: 40, w: 800, h: 500 },
        },
        { type: 'delete_slide', slideId: 's_aaaaa' },
      ]),
    );
    expect(next).not.toEqual(deck);
    const restored = applyPatches(next, inverse); // what the store's undo() does
    expect(restored).toEqual(deck);
  });

  it('removing one id patches array slots, not the whole order array (D24)', () => {
    const deck = makeDeck();
    const [, patches] = produceWithPatches(deck, (d) =>
      applyOp(d, { type: 'delete_slide', slideId: 's_ccccc' }),
    );
    expect(patches.some((p) => p.op === 'replace' && p.path.join('/') === 'slideOrder')).toBe(
      false,
    );
  });
});
