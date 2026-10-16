import { describe, expect, it } from 'vitest';
import { DeckSchema } from '../lib/schema/index.js';
import { createSampleDeck } from '../lib/sampleDeck.js';
import { makeDeck } from '../lib/test-fixtures.js';
import { starterElement } from '../lib/factories.js';
import {
  addBlankSlide,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  insertElement,
  moveSlideToIndex,
  ungroupSelection,
} from './actions.js';
import { createAppStore } from './index.js';

const move = (elementId, x) => ({
  type: 'move_element',
  elementId,
  bbox: { x, y: 300, w: 400, h: 200 },
});
const xOf = (store, id) => {
  const d = store.getState().deck;
  for (const sid of d.slideOrder)
    if (d.slides[sid].elements[id]) return d.slides[sid].elements[id].bbox.x;
};

describe('sample deck', () => {
  it('is a valid deck', () => {
    expect(DeckSchema.safeParse(createSampleDeck()).success).toBe(true);
  });
});

describe('dispatch + history', () => {
  it('one dispatch = one undo entry; undo/redo round-trip', () => {
    const store = createAppStore(makeDeck());
    const before = store.getState().deck;
    store.getState().dispatch([move('el_body', 300), move('el_chart', 500)], { label: 'Move 2' });
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().deck).toEqual(before);
    store.getState().redo();
    expect(xOf(store, 'el_chart')).toBe(500);
  });

  it('failed ops change nothing and report a typed error', () => {
    const store = createAppStore(makeDeck());
    const before = store.getState().deck;
    const res = store
      .getState()
      .dispatch([move('el_body', 300), { type: 'delete_element', elementId: 'el_gone' }]);
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(store.getState().deck).toBe(before); // all-or-nothing
    expect(store.getState().lastError.code).toBe('NOT_FOUND');
  });

  it('D25: ops of one AI turn merge into one entry; one undo reverts the whole turn', () => {
    const store = createAppStore(makeDeck());
    const before = store.getState().deck;
    const ai = { source: 'ai', turnId: 't_1' };
    store.getState().dispatch(move('el_body', 300), ai);
    store.getState().dispatch(move('el_chart', 500), ai);
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().past[0].opCount).toBe(2);
    store.getState().undo();
    expect(store.getState().deck).toEqual(before);
  });

  it('D25: a user edit mid-turn splits the turn, so undo never rewinds over the user edit', () => {
    const store = createAppStore(makeDeck());
    const ai = { source: 'ai', turnId: 't_1' };
    store.getState().dispatch(move('el_body', 300), ai);
    store.getState().dispatch(move('el_title', 700)); // user drags while the AI streams
    store.getState().dispatch(move('el_chart', 500), ai);
    expect(store.getState().past.map((e) => e.source)).toEqual(['ai', 'user', 'ai']);

    store.getState().undo(); // only the last AI op
    expect(xOf(store, 'el_chart')).toBe(96);
    expect(xOf(store, 'el_title')).toBe(700); // user edit intact
    expect(xOf(store, 'el_body')).toBe(300);
  });

  it('a new edit clears redo; deleting a selected element clears it from the selection', () => {
    const store = createAppStore(makeDeck());
    store.getState().dispatch(move('el_body', 300));
    store.getState().undo();
    store.getState().select('el_body');
    deleteSelection(store);
    expect(store.getState().future).toHaveLength(0);
    expect(store.getState().selection).toEqual([]);
    store.getState().undo();
    expect(xOf(store, 'el_body')).toBe(1260);
  });
});

describe('actions', () => {
  it('duplicateSelection copies with fresh ids, offset, and selects the copies', () => {
    const store = createAppStore(makeDeck());
    store.getState().select('el_chart');
    duplicateSelection(store);
    const [copyId] = store.getState().selection;
    expect(copyId).not.toBe('el_chart');
    expect(xOf(store, copyId)).toBe(136);
  });

  it('moveSlideToIndex converts a filmstrip index into an anchor', () => {
    const store = createAppStore(makeDeck()); // [a, b, c]
    moveSlideToIndex(store, 's_ccccc', 0);
    expect(store.getState().deck.slideOrder).toEqual(['s_ccccc', 's_aaaaa', 's_bbbbb']);
    moveSlideToIndex(store, 's_ccccc', 2);
    expect(store.getState().deck.slideOrder).toEqual(['s_aaaaa', 's_bbbbb', 's_ccccc']);
    moveSlideToIndex(store, 's_aaaaa', 1);
    expect(store.getState().deck.slideOrder).toEqual(['s_bbbbb', 's_aaaaa', 's_ccccc']);
  });

  it('addBlankSlide inserts after the given slide', () => {
    const store = createAppStore(makeDeck());
    const id = addBlankSlide(store, 's_aaaaa');
    expect(store.getState().deck.slideOrder[1]).toBe(id);
  });
});

describe('undo/redo reveal', () => {
  it('undo selects the affected element and publishes where it is', () => {
    const store = createAppStore(makeDeck());
    store.getState().dispatch({
      type: 'move_element',
      elementId: 'el_chart',
      toSlideId: 's_ccccc',
      bbox: { x: 40, y: 40, w: 400, h: 300 },
    });
    store.getState().select(null);
    store.getState().undo();
    expect(store.getState().selection).toEqual(['el_chart']);
    expect(store.getState().reveal).toMatchObject({ slideId: 's_bbbbb', elementIds: ['el_chart'] });
    store.getState().redo();
    expect(store.getState().reveal).toMatchObject({ slideId: 's_ccccc', elementIds: ['el_chart'] });
    expect(store.getState().reveal.seq).toBeGreaterThan(0);
  });
});

describe('insertElement (Insert menu)', () => {
  it('places into free room on the active slide, selected, one undo step', () => {
    const store = createAppStore(createSampleDeck());
    const s0 = store.getState();
    const slides = s0.deck.slideOrder.length;
    const id = insertElement(store, starterElement('rect'));
    const s = store.getState();
    expect(s.selection).toEqual([id]);
    expect(s.deck.slideOrder.length).toBe(slides);
    s.undo();
    expect(store.getState().deck).toEqual(s0.deck);
  });

  it('when the slide has no room, adds a slide after it instead of covering content', () => {
    const store = createAppStore(createSampleDeck());
    const deck = store.getState().deck;
    const second = deck.slideOrder[1]; // title + full-width body: no room for a chart
    store.getState().setActiveSlide(second);
    const id = insertElement(store, starterElement('chart-bar'));
    const after = store.getState().deck;
    expect(after.slideOrder.length).toBe(deck.slideOrder.length + 1);
    const newSlide = after.slideOrder[2];
    expect(after.slides[newSlide].elements[id].type).toBe('chart');
    expect(after.slides[second]).toEqual(deck.slides[second]);
  });
});

describe('side panel width', () => {
  it('clamps to the allowed range and rounds', () => {
    const store = createAppStore(makeDeck());
    store.getState().setSideWidth(100);
    expect(store.getState().sideWidth).toBe(320);
    store.getState().setSideWidth(5000);
    expect(store.getState().sideWidth).toBe(760);
    store.getState().setSideWidth(480.6);
    expect(store.getState().sideWidth).toBe(481);
  });
});

describe('AI change tracking for canvas motion (D48)', () => {
  it('records moved elements and removed ones per slide', () => {
    const store = createAppStore(makeDeck());
    const ai = { source: 'ai', turnId: 't1', label: 'AI' };
    store
      .getState()
      .dispatch({ type: 'update_element', elementId: 'el_title', patch: { bbox: { x: 200 } } }, ai);
    expect(store.getState().aiFlash.s_aaaaa).toMatchObject({
      elementIds: ['el_title'],
      removedIds: [],
    });
    store.getState().dispatch({ type: 'delete_element', elementId: 'el_title' }, ai);
    expect(store.getState().aiFlash.s_aaaaa).toMatchObject({
      elementIds: [],
      removedIds: ['el_title'],
    });
  });

  it('user edits never animate as AI changes', () => {
    const store = createAppStore(makeDeck());
    store.getState().dispatch({ type: 'delete_element', elementId: 'el_title' }, { label: 'Del' });
    expect(store.getState().aiFlash).toEqual({});
  });
});

describe('slide transition and speaker notes (D48)', () => {
  it('sets the deck transition and notes as undoable ops; rejects unknown transitions', () => {
    const store = createAppStore(makeDeck());
    const s = () => store.getState();
    expect(s().dispatch({ type: 'update_deck', patch: { transition: 'push' } }).ok).toBe(true);
    expect(s().deck.transition).toBe('push');
    expect(s().dispatch({ type: 'update_deck', patch: { transition: 'spin' } }).ok).toBe(false);
    s().dispatch(
      { type: 'update_slide', slideId: 's_bbbbb', patch: { notes: 'Lead with the 31%' } },
      { label: 'Edit speaker notes' },
    );
    expect(s().deck.slides.s_bbbbb.notes).toBe('Lead with the 31%');
    s().undo();
    expect(s().deck.slides.s_bbbbb.notes).toBe('');
  });
});

describe('groups (D53)', () => {
  it('group, select a member → whole group, duplicate makes a new group, ungroup', () => {
    const store = createAppStore(makeDeck());
    const s = () => store.getState();
    const [a, b] = s().deck.slides.s_bbbbb.elementOrder;
    s().setSelection([a, b]);
    expect(groupSelection(store).ok).toBe(true);
    const gid = s().deck.slides.s_bbbbb.elements[a].groupId;
    expect(gid).toMatch(/^g_/);
    s().select(null);
    s().select(b);
    expect(s().selection).toEqual([a, b]);
    duplicateSelection(store);
    const copies = s().selection;
    expect(copies).toHaveLength(2);
    const copyGroup = s().deck.slides.s_bbbbb.elements[copies[0]].groupId;
    expect(copyGroup).toBeTruthy();
    expect(copyGroup).not.toBe(gid);
    s().setSelection([a, b]);
    ungroupSelection(store);
    expect(s().deck.slides.s_bbbbb.elements[a].groupId).toBeUndefined();
    s().undo();
    expect(s().deck.slides.s_bbbbb.elements[a].groupId).toBe(gid);
  });

  it('a locked element can join a group (grouping does not move it)', () => {
    const store = createAppStore(makeDeck());
    const s = () => store.getState();
    const [a, b] = s().deck.slides.s_bbbbb.elementOrder;
    s().dispatch({ type: 'update_element', elementId: a, patch: { locked: true } });
    s().setSelection([a, b]);
    expect(groupSelection(store).ok).toBe(true);
  });
});
