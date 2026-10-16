import { describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../store/index.js';
import { makeDeck } from '../lib/test-fixtures.js';
import { currentDescription, srcFingerprint } from '../lib/imageInfo.js';
import { toRequestDeck } from '../lib/agent/request.js';
import { serializeDeck } from '../lib/agent/index.js';
import { startCaptioner } from './captions.js';

const withImage = (src = 'data:image/png;base64,ONE') => {
  const deck = makeDeck();
  deck.slides.s_ccccc.elements.el_pic = {
    id: 'el_pic',
    type: 'image',
    src,
    alt: 'lichess fen',
    fit: 'contain',
    bbox: { x: 100, y: 300, w: 600, h: 600 },
  };
  deck.slides.s_ccccc.elementOrder.push('el_pic');
  return deck;
};
const pic = (store) => store.getState().deck.slides.s_ccccc.elements.el_pic;

describe('image descriptions (D58)', () => {
  it('fingerprints differ by content and a stale description is ignored', () => {
    expect(srcFingerprint('data:a')).toBe(srcFingerprint('data:a'));
    expect(srcFingerprint('data:a')).not.toBe(srcFingerprint('data:b'));
    const el = withImage().slides.s_ccccc.elements.el_pic;
    el.description = { text: 'A chessboard', of: srcFingerprint(el.src) };
    expect(currentDescription(el)).toBe('A chessboard');
    expect(currentDescription({ ...el, src: 'data:image/png;base64,TWO' })).toBe('');
  });

  it('sends the description as text, never the picture, and drops a stale one', () => {
    const deck = withImage();
    const el = deck.slides.s_ccccc.elements.el_pic;
    el.description = { text: 'A chessboard, white to move', of: srcFingerprint(el.src) };
    const sent = toRequestDeck(deck).slides.s_ccccc.elements.el_pic;
    expect(sent.src).toBe('img:el_pic');
    expect(sent.description.text).toBe('A chessboard, white to move');
    expect(serializeDeck(toRequestDeck(deck))).toContain('shows: "A chessboard, white to move"');
    el.src = 'data:image/png;base64,TWO'; // replaced since
    expect(toRequestDeck(deck).slides.s_ccccc.elements.el_pic.description).toBeUndefined();
  });

  it('describes each picture once, without an undo step, and again after a replace', async () => {
    const store = createAppStore(withImage());
    const describe = vi.fn(async () => ({ description: 'A chessboard' }));
    const cap = startCaptioner(store, {
      shrink: async () => 'data:image/jpeg;base64,AA',
      describe,
    });
    await cap.idle();
    expect(currentDescription(pic(store))).toBe('A chessboard');
    expect(store.getState().past).toHaveLength(0);
    expect(describe).toHaveBeenCalledWith('data:image/jpeg;base64,AA', 'lichess fen');

    store.getState().dispatch({
      type: 'update_element',
      elementId: 'el_pic',
      patch: { src: 'data:image/png;base64,TWO' },
    });
    await vi.waitFor(() => expect(describe).toHaveBeenCalledTimes(2));
    await cap.idle();
    expect(currentDescription(pic(store))).toBe('A chessboard');
    expect(store.getState().past).toHaveLength(1); // only the user's replace
    cap.stop();
  });

  it('stops when no vision model is configured and skips pictures it cannot copy', async () => {
    const store = createAppStore(withImage());
    const describe = vi.fn(async () => ({ stop: true, message: 'no key' }));
    const cap = startCaptioner(store, { shrink: async () => 'x', describe });
    await cap.idle();
    store.getState().dispatch({
      type: 'update_element',
      elementId: 'el_pic',
      patch: { src: 'data:image/png;base64,TWO' },
    });
    await cap.idle();
    expect(describe).toHaveBeenCalledTimes(1);
    cap.stop();

    const store2 = createAppStore(withImage());
    const describe2 = vi.fn();
    const cap2 = startCaptioner(store2, {
      shrink: async () => {
        throw new Error('tainted');
      },
      describe: describe2,
    });
    await cap2.idle();
    expect(describe2).not.toHaveBeenCalled();
    cap2.stop();
  });

  it('a no-record dispatch changes the deck but leaves undo and redo alone', () => {
    const store = createAppStore(withImage());
    const s = store.getState();
    s.dispatch({ type: 'update_element', elementId: 'el_pic', patch: { alt: 'board' } });
    s.undo();
    store.getState().dispatch(
      {
        type: 'update_element',
        elementId: 'el_pic',
        patch: { description: { text: 'x', of: 'y' } },
      },
      { record: false },
    );
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().future).toHaveLength(1);
    store.getState().redo();
    expect(pic(store).alt).toBe('board');
  });
});
