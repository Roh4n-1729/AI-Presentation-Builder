import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './kvStore.js';

describe('memory key-value store (D52)', () => {
  it('gets, sets, deletes and lists keys', async () => {
    const kv = createMemoryStore();
    expect(await kv.get('missing')).toBeUndefined();
    await kv.set('a', { n: 1 });
    await kv.set('b', 2);
    expect(await kv.get('a')).toEqual({ n: 1 });
    expect((await kv.keys()).sort()).toEqual(['a', 'b']);
    await kv.del('a');
    expect(await kv.keys()).toEqual(['b']);
  });

  it('copies values in and out, like IndexedDB', async () => {
    const kv = createMemoryStore();
    const value = { deck: { title: 'A' } };
    await kv.set('k', value);
    value.deck.title = 'changed after saving';
    const read = await kv.get('k');
    expect(read.deck.title).toBe('A');
    read.deck.title = 'changed after reading';
    expect((await kv.get('k')).deck.title).toBe('A');
  });
});
