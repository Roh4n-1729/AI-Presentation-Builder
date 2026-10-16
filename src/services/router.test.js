import { describe, expect, it } from 'vitest';
import { parseRoute, routeFor } from './router.js';

describe('routes (D49)', () => {
  it('parses the three routes, anything else is the start screen', () => {
    expect(parseRoute('/')).toEqual({ name: 'start' });
    expect(parseRoute('/deck/d_abc12')).toEqual({ name: 'editor', id: 'd_abc12', present: null });
    expect(parseRoute('/deck/d_abc12/')).toEqual({ name: 'editor', id: 'd_abc12', present: null });
    expect(parseRoute('/deck/d_abc12/present/3')).toEqual({
      name: 'editor',
      id: 'd_abc12',
      present: 3,
    });
    expect(parseRoute('/deck/d_abc12/present')).toEqual({
      name: 'editor',
      id: 'd_abc12',
      present: 1,
    });
    expect(parseRoute('/deck/d_abc12/present/0').present).toBe(1);
    expect(parseRoute('/nope')).toEqual({ name: 'start' });
    expect(parseRoute('/deck/../etc')).toEqual({ name: 'start' });
  });

  it('derives the route from state, round-tripping through parseRoute', () => {
    const deck = { id: 'd_x1', title: 'T', slideOrder: ['s_1', 's_2'] };
    expect(routeFor({ screen: 'loading', deck })).toBeNull();
    expect(routeFor({ screen: 'start', deck })).toBe('/');
    expect(routeFor({ screen: 'editor', deck, presenting: null })).toBe('/deck/d_x1');
    const present = routeFor({ screen: 'editor', deck, presenting: { index: 1 } });
    expect(present).toBe('/deck/d_x1/present/2');
    expect(parseRoute(present)).toEqual({ name: 'editor', id: 'd_x1', present: 2 });
  });
});
