import { useLayoutEffect, useState } from 'react';
import { motion } from '@/hooks/motion.js';

const sameBox = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/**
 * Animate what an AI op changed on this slide (D48), so the user can follow it:
 * - moved / resized elements glide from their old box to the new one (left/top/width/height,
 *   not a scale, so text reflows instead of stretching);
 * - new elements fade and grow in;
 * - deleted elements leave a ghost that fades out (returned for the frame to render).
 *
 * Only AI changes animate (their `aiFlash.seq` is new); the user's own drags and undo don't.
 * The previous slide is kept in state and compared during render (React's "adjust state when a
 * prop changes" pattern), then the animations start in a layout effect, before paint.
 *
 * @returns {{ ghosts: { key: string, el: object }[], dropGhost: (key: string) => void }}
 */
export function useAiMotion(slide, aiFlash, artboardRef) {
  const [st, setSt] = useState(() => ({
    slide,
    seq: aiFlash?.seq ?? 0,
    pending: null,
    ghosts: [],
  }));

  if (st.slide !== slide) {
    let { pending, ghosts } = st;
    if (aiFlash && aiFlash.seq !== st.seq && st.slide && slide) {
      // Diff the whole slide, not just aiFlash's ids: several ops that arrive in one network
      // chunk render once, and aiFlash only lists the last op's elements.
      const before = st.slide.elements;
      const from = {};
      const enter = [];
      for (const [id, now] of Object.entries(slide.elements)) {
        if (!before[id]) enter.push(id);
        else if (!sameBox(before[id].bbox, now.bbox)) from[id] = before[id].bbox;
      }
      pending = { seq: aiFlash.seq, from, enter };
      const gone = Object.values(before)
        .filter((el) => !slide.elements[el.id])
        .map((el) => ({ key: `${aiFlash.seq}:${el.id}`, el }));
      if (gone.length) ghosts = [...ghosts, ...gone];
    }
    setSt({ slide, seq: aiFlash?.seq ?? st.seq, pending, ghosts });
  }

  const { pending } = st;
  useLayoutEffect(() => {
    const root = artboardRef.current;
    if (!pending || !root || !slide) return;
    const node = (id) => root.querySelector(`[data-el-id="${CSS.escape(id)}"]`);
    const px = (b) => ({
      left: `${b.x}px`,
      top: `${b.y}px`,
      width: `${b.w}px`,
      height: `${b.h}px`,
    });
    const running = [];
    for (const [id, was] of Object.entries(pending.from)) {
      const n = node(id);
      const now = slide.elements[id]?.bbox;
      if (n && now) running.push(n.animate([px(was), px(now)], motion('move')));
    }
    for (const id of pending.enter) {
      const n = node(id);
      if (n)
        running.push(
          n.animate(
            [
              { opacity: 0, scale: '0.96' },
              { opacity: 1, scale: '1' },
            ],
            motion('base', 'enter'),
          ),
        );
    }
    return () => running.forEach((a) => a.finish());
    // Keyed on the pending batch only: a re-render of the same slide must not replay it.
  }, [pending]);

  const dropGhost = (key) =>
    setSt((s) => ({ ...s, ghosts: s.ghosts.filter((g) => g.key !== key) }));
  return { ghosts: st.ghosts, dropGhost };
}
