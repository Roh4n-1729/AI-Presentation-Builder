import PptxGenJS from 'pptxgenjs';
import { describe, expect, it } from 'vitest';
import { createSampleDeck } from '../sampleDeck.js';
import { getTheme, textStyleFor } from '../theme/index.js';
import { buildPptxModel, chartCall, inch, pptxColor, pt, textCall, writePptx } from './pptx.js';

const theme = getTheme('paper');
const deck = createSampleDeck();
const els = Object.values(deck.slides).flatMap((s) => Object.values(s.elements));

describe('PowerPoint export model (D44)', () => {
  it('maps the artboard exactly onto a 13.333 x 7.5 in slide', () => {
    expect(inch(1920)).toBeCloseTo(13.3333, 3);
    expect(inch(1080)).toBeCloseTo(7.5, 3);
    expect(pt(72)).toBe(36); // a 72-unit title is 36 pt
  });

  it('writes 6-digit hex colors without #, alpha as transparency', () => {
    expect(pptxColor('#4250d5')).toEqual({ color: '4250D5' });
    expect(pptxColor('#abc')).toEqual({ color: 'AABBCC' });
    expect(pptxColor('#00000080')).toEqual({ color: '000000', transparency: 50 });
  });

  it('uses the measured fit, never larger than the stored size, in export fonts', () => {
    const title = els.find((e) => e.type === 'text' && e.role === 'title');
    const call = textCall(title, theme, 60); // measured: 60 units
    expect(call.options).toMatchObject({
      fontFace: 'Cambria',
      fontSize: 30,
      margin: 0,
      valign: 'top',
    });
    const stored = textStyleFor(title, theme).fontSize;
    expect(textCall(title, theme, 500).options.fontSize).toBe(pt(stored));
  });

  it('keeps bullets as real bullets with breaks between paragraphs', () => {
    const body = els.find((e) => e.type === 'text' && e.paragraphs.some((p) => p.bullet));
    const { runs } = textCall(body, theme);
    expect(runs.every((r) => r.options.bullet)).toBe(true);
    expect(runs.at(-1).options.breakLine).toBe(false);
    expect(runs.some((r) => r.text.startsWith('•'))).toBe(false);
  });

  it('charts stay native; stacked bars never get outEnd labels (corrupts the file)', () => {
    const chart = els.find((e) => e.type === 'chart');
    const stacked = chartCall(
      { ...chart, chart: { ...chart.chart, kind: 'stacked-bar', showDataLabels: true } },
      theme,
    );
    expect(stacked.type).toBe('bar');
    expect(stacked.options.barGrouping).toBe('stacked');
    expect(stacked.options.dataLabelPosition).toBe('ctr');
    const pie = chartCall({ ...chart, chart: { ...chart.chart, kind: 'pie' } }, theme);
    expect(pie.type).toBe('doughnut');
    expect(pie.data).toHaveLength(1);
    expect(pie.options.chartColors.every((c) => /^[0-9A-F]{6}$/.test(c))).toBe(true);
  });

  it('builds and writes the whole sample deck', async () => {
    const model = buildPptxModel(deck, theme);
    expect(model).toHaveLength(deck.slideOrder.length);
    const pres = writePptx(PptxGenJS, deck, model);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    expect(buf.length).toBeGreaterThan(20_000);
    // the model is reusable: writing twice must not see options mutated by the first write
    const again = await writePptx(PptxGenJS, deck, model).write({ outputType: 'nodebuffer' });
    expect(again.length).toBe(buf.length);
  });
});

describe('stock photo credits (D57)', () => {
  it('adds a credit line per credited photo to the slide notes', () => {
    const deck = createSampleDeck();
    const sid = deck.slideOrder.find((id) =>
      Object.values(deck.slides[id].elements).some((el) => el.type === 'image'),
    );
    const slide = deck.slides[sid];
    const img = Object.values(slide.elements).find((el) => el.type === 'image');
    img.src = 'data:image/jpeg;base64,AA';
    img.credit = {
      text: '"Planning" by Ann Lee (CC BY 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Planning.jpg',
      license: 'CC BY 4.0',
      source: 'wikimedia',
    };
    slide.notes = 'Say hello.';
    const model = buildPptxModel(deck, theme);
    const notes = model.find((s) => s.id === sid).notes;
    expect(notes).toBe(
      'Say hello.\n\nImage: "Planning" by Ann Lee (CC BY 4.0) https://commons.wikimedia.org/wiki/File:Planning.jpg',
    );
  });
});
