import { describe, expect, it } from 'vitest';
import { clampCrop, coverCrop, cropLayout, resizeCrop, zoomCrop } from './crop.js';
import { ImageElementSchema } from './schema/elements.js';

const nat = { w: 1600, h: 900 }; // 16:9 photo
const aspectOf = (c) => (c.w * nat.w) / (c.h * nat.h);

describe('image crop (D53)', () => {
  it('starts from what "fill" shows: centred, box aspect', () => {
    const c = coverCrop(nat, 1); // square box on a wide photo
    expect(c.h).toBe(1);
    expect(c.w).toBeCloseTo(900 / 1600);
    expect(c.x).toBeCloseTo((1 - 900 / 1600) / 2);
    expect(aspectOf(c)).toBeCloseTo(1);
  });

  it('resizing from a corner keeps the aspect and the opposite corner', () => {
    const c0 = coverCrop(nat, 1);
    const c = resizeCrop(c0, 'nw', 0.1, nat, 1); // drag top-left inward
    expect(aspectOf(c)).toBeCloseTo(1);
    expect(c.x + c.w).toBeCloseTo(c0.x + c0.w);
    expect(c.y + c.h).toBeCloseTo(c0.y + c0.h);
    expect(c.w).toBeLessThan(c0.w);
  });

  it('never leaves the image, and zoom stays centred where it can', () => {
    const c = clampCrop({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, nat, 16 / 9);
    expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
    const z = zoomCrop({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 0.5, nat, 16 / 9);
    expect(z.x + z.w / 2).toBeCloseTo(0.5);
  });

  it('lays the region over the box without stretching (cover)', () => {
    const crop = { x: 0.25, y: 0, w: 0.5, h: 1 }; // 800×900 region
    const { clip, img } = cropLayout(crop, nat, 400, 450);
    expect(clip).toEqual({ left: 0, top: 0, width: 400, height: 450 });
    expect(img.width / img.height).toBeCloseTo(16 / 9);
    expect(img.left).toBeCloseTo(-200);
  });

  it('schema keeps crops inside the image', () => {
    const base = { id: 'el_img01', type: 'image', bbox: { x: 0, y: 0, w: 10, h: 10 }, src: 'x' };
    expect(
      ImageElementSchema.safeParse({ ...base, crop: { x: 0.6, y: 0, w: 0.5, h: 1 } }).success,
    ).toBe(false);
    expect(
      ImageElementSchema.safeParse({ ...base, crop: { x: 0.5, y: 0, w: 0.5, h: 1 } }).success,
    ).toBe(true);
  });
});
