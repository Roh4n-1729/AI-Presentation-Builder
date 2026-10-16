import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DeckSchema } from '../schema/index.js';
import { createSampleDeck } from '../sampleDeck.js';
import { createDeck } from '../factories.js';
import { findElement } from '../ops/index.js';
import { makeDeck } from '../test-fixtures.js';
import {
  buildElementPatch,
  createDeckTools,
  createPlanTool,
  pickTools,
  serializeDeck,
  toRequestDeck,
} from './index.js';

const setup = (deck = makeDeck(), opts = {}) => {
  const ctx = { deck };
  const emitted = [];
  const tools = createDeckTools(ctx, { emit: (e) => emitted.push(e), ...opts });
  return { ctx, emitted, tools };
};

describe('tool schemas are portable (D11 flat inputs)', () => {
  it('no anyOf / oneOf / nullable / records in any tool input', () => {
    const { tools } = setup();
    const all = { ...tools, ...createPlanTool({ deck: makeDeck() }) };
    for (const [name, t] of Object.entries(all)) {
      const json = JSON.stringify(z.toJSONSchema(t.inputSchema));
      expect(json, name).not.toMatch(/"anyOf"|"oneOf"|"nullable"|"additionalProperties":\{/);
    }
  });
});

describe('add tools', () => {
  it('add_chart places into the free slot, mints an id, applies to the working copy and emits one op', () => {
    const deck = makeDeck();
    delete deck.slides.s_bbbbb.elements.el_chart; // free the 'visual' slot
    deck.slides.s_bbbbb.elementOrder = ['el_body'];
    const { ctx, emitted, tools } = setup(deck);
    const r = tools.add_chart.execute({
      slideId: 's_bbbbb',
      kind: 'bar',
      title: 'Revenue',
      categories: ['Q1', 'Q2'],
      series: [{ name: '2026', values: [1, 2] }],
    });
    expect(r).toMatchObject({ ok: true, slideId: 's_bbbbb' });
    expect(r.elementId).toMatch(/^el_/);
    expect(findElement(ctx.deck, r.elementId).el.slot).toBe('visual');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].ops[0]).toMatchObject({ type: 'add_element', slideId: 's_bbbbb' });
    expect(DeckSchema.safeParse(ctx.deck).success).toBe(true);
  });

  it('bad data comes back as a result the model can fix; nothing is emitted', () => {
    const { ctx, emitted, tools } = setup();
    const before = ctx.deck;
    const r = tools.add_chart.execute({
      slideId: 's_bbbbb',
      kind: 'bar',
      categories: ['Q1', 'Q2', 'Q3'],
      series: [{ name: 'x', values: [1] }],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('one value per category');
    expect(emitted).toHaveLength(0);
    expect(ctx.deck).toBe(before);
  });

  it('add_chart keeps only series with numbers; an all-empty chart is refused (D51)', () => {
    const deck = makeDeck();
    delete deck.slides.s_bbbbb.elements.el_chart;
    deck.slides.s_bbbbb.elementOrder = ['el_body'];
    const { ctx, emitted, tools } = setup(deck);
    const r = tools.add_chart.execute({
      slideId: 's_bbbbb',
      kind: 'bar',
      categories: ['TAM', 'SAM', 'SOM'],
      series: [
        { name: 'Market size', values: [12000, 180, 12] },
        { name: 'Series 3', values: [0, 0, 0] },
      ],
    });
    expect(r.ok).toBe(true);
    expect(findElement(ctx.deck, r.elementId).el.chart.series.map((s) => s.name)).toEqual([
      'Market size',
    ]);
    const bad = tools.add_chart.execute({
      slideId: 's_bbbbb',
      kind: 'bar',
      categories: ['A'],
      series: [{ name: 'x', values: [0] }],
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('empty');
    expect(emitted).toHaveLength(1);
  });

  it('unknown slide ids are explained', () => {
    const { tools } = setup();
    expect(
      tools.add_text.execute({ slideId: 's_nope1', role: 'body', paragraphs: ['x'] }).error,
    ).toContain('NOT_FOUND');
  });

  it('defaultSlideId lets populate omit slideId; body text becomes bullets', () => {
    const { ctx, tools } = setup(makeDeck(), { defaultSlideId: 's_ccccc' });
    const r = tools.add_text.execute({ role: 'body', paragraphs: ['One', 'Two'] });
    const el = findElement(ctx.deck, r.elementId).el;
    expect(el.paragraphs).toEqual([
      { text: 'One', bullet: true },
      { text: 'Two', bullet: true },
    ]);
    expect(el.slot).toBe('body');
  });
});

describe('edit tools patch in place', () => {
  it('update_element rewrites text keeping id and position', () => {
    const { ctx, tools } = setup();
    const before = findElement(ctx.deck, 'el_body').el;
    expect(tools.update_element.execute({ elementId: 'el_body', paragraphs: ['Shorter'] }).ok).toBe(
      true,
    );
    const after = findElement(ctx.deck, 'el_body').el;
    expect(after.paragraphs).toEqual([{ text: 'Shorter', bullet: true }]);
    expect(after.bbox).toEqual(before.bbox);
  });

  it('update_element rejects fields that do not apply', () => {
    const { tools } = setup();
    expect(
      tools.update_element.execute({ elementId: 'el_chart', paragraphs: ['x'] }).error,
    ).toContain('does not apply');
  });

  it('change_chart_type keeps the data; update_chart_data replaces it', () => {
    const { ctx, tools } = setup();
    tools.change_chart_type.execute({ elementId: 'el_chart', kind: 'line' });
    expect(findElement(ctx.deck, 'el_chart').el.chart).toMatchObject({
      kind: 'line',
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    });
    tools.update_chart_data.execute({
      elementId: 'el_chart',
      categories: ['A', 'B'],
      series: [{ name: 's', values: [1, 2] }],
    });
    expect(findElement(ctx.deck, 'el_chart').el.chart.categories).toEqual(['A', 'B']);
  });

  it('move_element to another slide finds free space there', () => {
    const { ctx, tools } = setup();
    const r = tools.move_element.execute({ elementId: 'el_chart', toSlideId: 's_ccccc' });
    expect(r).toMatchObject({ ok: true, slideId: 's_ccccc' });
    expect(findElement(ctx.deck, 'el_chart').slide.id).toBe('s_ccccc');
  });

  it('locked elements refuse AI edits', () => {
    const deck = makeDeck();
    deck.slides.s_bbbbb.elements.el_chart.locked = true;
    const { tools } = setup(deck);
    expect(tools.delete_element.execute({ elementId: 'el_chart' }).error).toContain('LOCKED');
  });

  it('update_elements is all-or-nothing', () => {
    const { ctx, emitted, tools } = setup();
    const r = tools.update_elements.execute({
      updates: [
        { elementId: 'el_body', paragraphs: ['ok'] },
        { elementId: 'el_ghost', paragraphs: ['nope'] },
      ],
    });
    expect(r.ok).toBe(false);
    expect(findElement(ctx.deck, 'el_body').el.paragraphs[0].text).toBe('+31% YoY');
    expect(emitted).toHaveLength(0);
  });

  it('add_slide with START anchor goes first and gets a title box', () => {
    const { ctx, tools } = setup();
    const r = tools.add_slide.execute({
      title: 'Pricing',
      layout: 'content',
      afterSlideId: 'START',
    });
    expect(ctx.deck.slideOrder[0]).toBe(r.slideId);
    expect(findElement(ctx.deck, r.titleElementId).el.paragraphs[0].text).toBe('Pricing');
  });

  it('finish_turn records the summary', () => {
    const { ctx, tools } = setup();
    tools.finish_turn.execute({ summary: 'Done', suggestions: ['More'] });
    expect(ctx.finish).toEqual({ summary: 'Done', suggestions: ['More'] });
  });

  it('populate gets a small toolset', () => {
    const { tools } = setup();
    expect(Object.keys(pickTools(tools, 'populate'))).not.toContain('delete_slide');
  });
});

describe('plan_deck', () => {
  it('creates titled skeleton slides in order and keeps briefs', () => {
    const ctx = { deck: createDeck({ id: 'd_new' }) };
    const emitted = [];
    const { plan_deck } = createPlanTool(ctx, { emit: (e) => emitted.push(e) });
    const r = plan_deck.execute({
      title: 'Q3 Roadmap',
      slides: [
        { title: 'Q3 Roadmap', layout: 'title', intent: 'Open', keyPoints: [], visual: 'none' },
        {
          title: 'Revenue grew 31%',
          layout: 'chart-focus',
          intent: 'Show growth',
          keyPoints: ['Q3 $5.1M'],
          visual: 'chart',
        },
      ],
    });
    expect(r.ok).toBe(true);
    expect(ctx.deck.title).toBe('Q3 Roadmap');
    expect(ctx.deck.slideOrder.map((id) => ctx.deck.slides[id].title)).toEqual([
      'Q3 Roadmap',
      'Revenue grew 31%',
    ]);
    expect(ctx.plan.briefs[1]).toMatchObject({ visual: 'chart', layout: 'chart-focus' });
    expect(emitted).toHaveLength(1); // one batch = one render, one history entry
    expect(DeckSchema.safeParse(ctx.deck).success).toBe(true);
  });
});

describe('context and request contract', () => {
  it('serializes ids, order, boxes, chart data and the selection compactly', () => {
    const text = serializeDeck(makeDeck(), { activeSlideId: 's_bbbbb', selection: ['el_chart'] });
    expect(text).toContain('[2] s_bbbbb "Revenue" layout=chart-focus');
    expect(text).toContain(
      'el_chart chart (96,250 1100x740) slot=visual bar "Quarterly revenue" cats=[Q1,Q2,Q3,Q4] series=[2026:10,12,15,18]',
    );
    expect(text).toContain('User has selected: el_chart (chart on slide 2)');
  });

  it('a dragged chart shows on its new slide on the next turn', () => {
    const { ctx, tools } = setup();
    tools.move_element.execute({ elementId: 'el_chart', toSlideId: 's_aaaaa' });
    const text = serializeDeck(ctx.deck);
    expect(text.indexOf('el_chart')).toBeLessThan(text.indexOf('[2]'));
  });

  it('never sends image data', () => {
    const deck = createSampleDeck();
    deck.slides.s_next.elements.el_next_image.src = `data:image/png;base64,${'A'.repeat(50000)}`;
    const req = toRequestDeck(deck);
    expect(req.slides.s_next.elements.el_next_image.src).toBe('img:el_next_image');
    expect(JSON.stringify(req).length).toBeLessThan(20000);
    expect(deck.slides.s_next.elements.el_next_image.src.startsWith('data:')).toBe(true); // original untouched
  });
});

describe('image query changes (D57)', () => {
  it('a new query turns a photo back into a placeholder; the same query changes nothing', () => {
    const deck = makeDeck();
    deck.slides.s_ccccc.elements.el_img = {
      id: 'el_img',
      type: 'image',
      src: 'data:image/jpeg;base64,AA',
      alt: 'desk',
      fit: 'cover',
      query: 'desk',
      credit: { text: 'x', license: 'CC0', source: 'openverse' },
      bbox: { x: 100, y: 300, w: 800, h: 450 },
    };
    deck.slides.s_ccccc.elementOrder.push('el_img');
    const { patch } = buildElementPatch(deck, { elementId: 'el_img', query: 'city skyline' });
    expect(patch).toMatchObject({ query: 'city skyline', src: '', credit: null });
    expect(buildElementPatch(deck, { elementId: 'el_img', query: 'desk' }).error).toBeDefined();
  });
});

describe('move_element onto a full slide (D63)', () => {
  it('makes room on the target instead of covering its content, in one tool call', () => {
    const { ctx, emitted, tools } = setup(createSampleDeck());
    const [, s2, s3] = ctx.deck.slideOrder;
    const r = tools.move_element.execute({ elementId: 'el_rev_chart', toSlideId: s2 });
    expect(r.ok).toBe(true);
    const ops = emitted.at(-1).ops;
    expect(ops[0]).toMatchObject({ type: 'move_element', toSlideId: s2 });
    expect(ops.slice(1).every((o) => o.type === 'update_element' && o.patch.bbox)).toBe(true);
    const target = ctx.deck.slides[s2];
    const moved = target.elements.el_rev_chart.bbox;
    for (const id of target.elementOrder)
      if (id !== 'el_rev_chart') {
        const b = target.elements[id].bbox;
        const hit =
          moved.x < b.x + b.w &&
          moved.x + moved.w > b.x &&
          moved.y < b.y + b.h &&
          moved.y + moved.h > b.y;
        expect(hit).toBe(false);
      }
    expect(ctx.deck.slides[s3].elements.el_rev_chart).toBeUndefined();
  });
});

describe('cover-style slides while generating (D64)', () => {
  const deckWithCovers = () => {
    const deck = createDeck({ id: 'd_cov', title: 'AI growth' });
    const mk = (id, layout, title, ty) => {
      const s = {
        id,
        title,
        layout,
        background: { color: 'bg' },
        notes: '',
        elementOrder: ['el_t' + id, 'el_s' + id],
        elements: {
          ['el_t' + id]: {
            id: 'el_t' + id,
            type: 'text',
            role: 'title',
            slot: 'title',
            bbox: { x: 160, y: ty, w: 1600, h: 200 },
            paragraphs: [{ text: title }],
            style: {},
          },
          ['el_s' + id]: {
            id: 'el_s' + id,
            type: 'text',
            role: 'subtitle',
            slot: 'subtitle',
            bbox: { x: 160, y: ty + 230, w: 1600, h: 120 },
            paragraphs: [{ text: 'Sub' }],
            style: {},
          },
        },
      };
      deck.slides[id] = s;
      deck.slideOrder.push(id);
    };
    mk('s_cover01', 'title', 'AI growth', 330);
    mk('s_sect001', 'section', 'Milestones', 400);
    return deck;
  };

  it('refuses bullets on the cover and tells the model where they go', () => {
    const { ctx, emitted, tools } = setup(deckWithCovers(), { phase: 'populate' });
    const r = tools.add_text.execute({
      slideId: 's_cover01',
      role: 'body',
      paragraphs: ['A', 'B'],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cover/);
    expect(emitted).toHaveLength(0);
    expect(ctx.deck.slides.s_cover01.elementOrder).toHaveLength(2);
  });

  it('moves a later cover-style slide to the content layout, content below the title', () => {
    const { ctx, emitted, tools } = setup(deckWithCovers(), { phase: 'populate' });
    const r = tools.add_text.execute({
      slideId: 's_sect001',
      role: 'body',
      paragraphs: ['A', 'B'],
    });
    expect(r.ok).toBe(true);
    expect(emitted.map((e) => e.toolName)).toEqual(['change_layout', 'add_text']);
    const slide = ctx.deck.slides.s_sect001;
    expect(slide.layout).toBe('content');
    const title = slide.elements.el_ts_sect001.bbox;
    expect(r.bbox.y).toBeGreaterThanOrEqual(title.y + title.h);
  });

  it('outside generation, auto-placed content still never goes above the title', () => {
    const { tools } = setup(deckWithCovers());
    const r = tools.add_text.execute({ slideId: 's_cover01', role: 'body', paragraphs: ['A'] });
    expect(r.ok).toBe(true);
    expect(r.bbox.y).toBeGreaterThanOrEqual(330 + 200);
  });
});
