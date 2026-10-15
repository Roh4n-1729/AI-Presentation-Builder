import { describe, expect, it } from 'vitest';
import { elementId, slideId, turnId } from './ids.js';

describe('ids', () => {
  it('are short and prefixed', () => {
    expect(slideId()).toMatch(/^s_[a-z2-9]{7}$/);
    expect(elementId()).toMatch(/^el_[a-z2-9]{7}$/);
    expect(turnId()).toMatch(/^t_[a-z2-9]{7}$/);
  });

  it('do not repeat across a realistic deck', () => {
    const ids = new Set(Array.from({ length: 2000 }, elementId));
    expect(ids.size).toBe(2000);
  });
});
