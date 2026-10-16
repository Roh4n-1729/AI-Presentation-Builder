import { describe, expect, it } from 'vitest';
import { deckPath, presentPath, slideIndexFrom, titleFor } from './routes.js';

describe('routes (D59)', () => {
  it('builds paths', () => {
    expect(deckPath('d_abc')).toBe('/deck/d_abc');
    expect(presentPath('d_abc', 3)).toBe('/deck/d_abc/present/3');
    expect(presentPath('d_abc', 0)).toBe('/deck/d_abc/present/1');
  });
  it('reads a slide param as a clamped 0-based index', () => {
    expect(slideIndexFrom('3', 5)).toBe(2);
    expect(slideIndexFrom('99', 5)).toBe(4);
    expect(slideIndexFrom('0', 5)).toBe(0);
    expect(slideIndexFrom('x', 5)).toBe(0);
    expect(slideIndexFrom(undefined, 5)).toBe(0);
    expect(slideIndexFrom('2', 0)).toBeNull();
  });
  it('titles the tab', () => {
    expect(titleFor('Q3 Roadmap')).toBe('Q3 Roadmap · AI Presentation Builder');
    expect(titleFor('')).toBe('AI Presentation Builder');
  });
});
