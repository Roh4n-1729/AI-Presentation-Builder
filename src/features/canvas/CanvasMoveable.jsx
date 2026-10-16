import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Moveable from 'react-moveable';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { remapGroups } from '@/lib/groups.js';
import { groupId as newGroupId, elementId as newElementId } from '@/lib/ids.js';
import { fitOnSlide, shiftGroup } from '@/lib/layout/index.js';
import { pendingDrag } from './pendingDrag.js';

const ALL_SIDES = { top: true, left: true, bottom: true, right: true, center: true, middle: true };
const SCROLL_OPTIONS = { checkScrollEvent: true };

/** Ops for the elements that gave up room on a full slide (D63). */
const makeRoomOps = (fit) =>
  fit.adjust.map((a) => ({
    type: 'update_element',
    elementId: a.id,
    patch: { bbox: a.bbox },
  }));

/** Remember the inline styles Moveable will change during a gesture. */
const saveStyles = (nodes) =>
  new Map(
    nodes.map((n) => [
      n,
      { transform: n.style.transform, width: n.style.width, height: n.style.height },
    ]),
  );

/** Put them back: on release the store owns position again (React re-renders left/top); on Escape
 *  this alone undoes the whole gesture. Moveable works on the DOM directly, by design. */
function restoreStyles(originals) {
  for (const [node, o] of originals ?? []) {
    node.style.transform = o.transform;
    node.style.width = o.width;
    node.style.height = o.height;
  }
}

/**
 * A click (no drag) inside a multi-selection. Moveable covers the selection with one drag area,
 * so the click never reaches the element underneath; resolve it here (D56). A single group stays
 * selected as a unit; otherwise (several elements, or after Ungroup) the click selects just the
 * topmost element under the pointer, Shift toggles it, and a click on empty space between them
 * clears the selection, as in PowerPoint and Figma.
 */
function clickInSelection(slide, targets, e) {
  const ids = targets.map((n) => n.dataset.elId);
  const groupIds = new Set(ids.map((id) => slide.elements[id]?.groupId ?? null));
  if (groupIds.size === 1 && !groupIds.has(null)) return;
  const x = e.clientX;
  const y = e.clientY;
  const under = ids.filter((id) => {
    const r = targets[ids.indexOf(id)].getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
  const top = slide.elementOrder.filter((id) => under.includes(id)).at(-1);
  const s = getDeckState();
  if (top) s.select(top, !!e.inputEvent?.shiftKey);
  else if (!e.inputEvent?.shiftKey) s.select(null);
}

/**
 * Drag / resize / snap for the selected elements of ONE slide (D7).
 *
 * During a gesture Moveable changes only the DOM node's inline transform (smooth, no React
 * render per frame). The store is written once, on release: one op, one undo entry. Escape
 * restores the inline styles and writes nothing, so cancel is trivially correct.
 *
 * Cross-slide: while dragging we hit-test under the pointer. Another slide frame (adjacent
 * slide) or a filmstrip thumbnail becomes the drop target, and release dispatches
 * move_element { toSlideId, bbox } with a resolved box (D24). Alt/Option on release = copy.
 */
export function CanvasMoveable({ slide, frameRef, artboardRef, scale }) {
  const selection = useDeck((s) => s.selection);
  const editingId = useDeck((s) => s.editingId);

  const moveableRef = useRef(null);
  const gesture = useRef(null); // { cancelled, originals: Map<node, {transform,width,height}>, pointer }
  const [targets, setTargets] = useState([]);
  const [guides, setGuides] = useState([]);
  const [badge, setBadge] = useState(null);
  // The slide column is the scroll container Moveable watches during a drag. A getter, resolved
  // when the drag starts: on first mount a child's layout effect runs before the parent's ref is
  // attached, so reading frameRef.current eagerly would find nothing.
  const getScroller = () => frameRef.current?.closest('[data-scroll-column]') ?? null;

  const selectedHere = selection.filter((id) => slide.elements[id] && id !== editingId);
  const selectedKey = selectedHere.join(',');

  // Resolve selected ids -> DOM nodes after render. Other elements + the artboard become snap guides.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const ids = selectedKey ? selectedKey.split(',') : [];
    const nodes = ids.map((id) => frame.querySelector(`[data-el-id="${id}"]`)).filter(Boolean);
    const others = [...frame.querySelectorAll('.el')].filter((n) => !nodes.includes(n));
    setTargets(nodes);
    setGuides([artboardRef.current, ...others].filter(Boolean));
  }, [selectedKey, slide, frameRef, artboardRef]);

  // Gotcha 10: Moveable caches the target's rect. Any change that moves the element without
  // Moveable (gesture commit, undo/redo, AI op, zoom) must re-measure, before paint.
  useLayoutEffect(() => {
    moveableRef.current?.updateRect();
  }, [slide, scale, targets]);

  // Gotcha 2: selected-and-dragged in the same pointer gesture.
  useEffect(() => {
    if (targets.length !== 1) return;
    const pending = pendingDrag.takeFor(targets[0].dataset.elId);
    if (pending) {
      requestAnimationFrame(() => {
        if (pendingDrag.isPointerDown()) moveableRef.current?.dragStart(pending.event);
      });
    }
  }, [targets]);

  // Gotcha 3: Escape during a gesture restores every touched node. Capture phase +
  // stopImmediatePropagation so the global Escape doesn't also clear the selection.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || !gesture.current) return;
      e.stopImmediatePropagation();
      gesture.current.cancelled = true;
      restoreStyles(gesture.current.originals);
      getDeckState().setDragging(null);
      getDeckState().setDropTarget(null);
      setBadge(null);
      moveableRef.current?.updateRect();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // While the column scrolls under a still pointer (edge auto-scroll, wheel), Moveable shifts the
  // gesture origin but only re-runs the drag on the next mouse move. Replaying a mousemove at the
  // last pointer position (on the next frame, after Moveable's own scroll listener) keeps the
  // element under the cursor and the drop target up to date.
  const replayPointer = (g) => {
    if (gesture.current !== g || g.cancelled || !g.pointer) return;
    const { x, y, alt } = g.pointer;
    window.dispatchEvent(
      new MouseEvent('mousemove', { clientX: x, clientY: y, altKey: alt, bubbles: true }),
    );
  };
  const onColumnScroll = () => {
    const g = gesture.current;
    if (!g?.pointer || g.cancelled || g.raf) return;
    g.raf = requestAnimationFrame(() => {
      g.raf = 0;
      replayPointer(g);
    });
  };

  const begin = (nodes) => {
    const scroller = getScroller();
    scroller?.addEventListener('scroll', onColumnScroll, { passive: true });
    gesture.current = { cancelled: false, originals: saveStyles(nodes), scroller };
    // In the store, not classList: re-renders (e.g. the active slide changing while the column
    // scrolls) would otherwise rewrite className and drop the class mid-drag.
    getDeckState().setDragging(slide.id);
  };

  const end = () => {
    restoreStyles(gesture.current?.originals);
    gesture.current?.scroller?.removeEventListener('scroll', onColumnScroll);
    if (gesture.current?.raf) cancelAnimationFrame(gesture.current.raf);
    gesture.current = null;
    getDeckState().setDragging(null);
    getDeckState().setDropTarget(null);
    setBadge(null);
  };

  /** Gotcha 8: the first thumbnail or other slide frame under the pointer. */
  const hitTest = (clientX, clientY) => {
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      const thumb = node.closest?.('[data-slide-drop]');
      if (thumb && thumb.dataset.slideDrop !== slide.id)
        return { kind: 'thumb', slideId: thumb.dataset.slideDrop, node: thumb };
      const frame = node.closest?.('[data-slide-frame]');
      if (frame && frame.dataset.slideFrame !== slide.id)
        return { kind: 'frame', slideId: frame.dataset.slideFrame, node: frame };
    }
    return null;
  };

  const bboxOf = (node) => slide.elements[node.dataset.elId].bbox;

  // Auto-scroll: Moveable reports the pointer within `scrollThreshold` of the column's top or
  // bottom edge; we scroll, and `checkScrollEvent` makes Moveable shift the gesture by the scroll
  // offset so the element stays under the cursor (also when the user scrolls with the wheel).
  // Horizontal direction set = pointer is over the filmstrip or chat: don't scroll then.
  const onAutoScroll = ({ scrollContainer, direction }) => {
    if (direction[0] !== 0 || direction[1] === 0) return;
    scrollContainer.scrollTop += direction[1] * 18;
    // Moveable shifts the gesture origin synchronously right after this handler returns, so a
    // microtask replay re-runs the drag in the same task: no frame where the element lags.
    const g = gesture.current;
    queueMicrotask(() => replayPointer(g));
  };
  const dispatch = (ops, label) => getDeckState().dispatch(ops, { label });

  if (targets.length === 0) return null;
  const single = targets.length === 1;
  const locked = targets.some((n) => n.dataset.locked);

  return (
    <>
      <Moveable
        ref={moveableRef}
        target={single ? targets[0] : targets}
        draggable={!locked}
        resizable={single && !locked}
        keepRatio={false}
        throttleDrag={0}
        throttleResize={0}
        origin={false}
        snappable
        snapThreshold={8}
        isDisplaySnapDigit
        snapGap
        elementGuidelines={guides}
        snapDirections={ALL_SIDES}
        elementSnapDirections={ALL_SIDES}
        renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
        scrollable
        scrollContainer={getScroller}
        scrollThreshold={60}
        scrollThrottleTime={16}
        scrollOptions={SCROLL_OPTIONS}
        onScroll={onAutoScroll}
        onScrollGroup={onAutoScroll}
        /* ---- single drag ---- */
        onDragStart={(e) => begin([e.target])}
        onDrag={(e) => {
          if (gesture.current?.cancelled) return;
          e.target.style.transform = e.transform;
          gesture.current.pointer = { x: e.clientX, y: e.clientY, alt: !!e.inputEvent?.altKey };
          const hit = hitTest(e.clientX, e.clientY);
          const copy = !!e.inputEvent?.altKey;
          getDeckState().setDropTarget(hit?.slideId ?? null, copy);
          setBadge(hit ? { x: e.clientX, y: e.clientY, copy } : null);
        }}
        onDragEnd={(e) => {
          const g = gesture.current;
          if (!g || g.cancelled || !e.lastEvent) return end();
          const id = e.target.dataset.elId;
          const [tx, ty] = e.lastEvent.beforeTranslate;
          const old = bboxOf(e.target);
          const p = g.pointer ?? { x: e.clientX, y: e.clientY, alt: false };
          const copy = e.inputEvent?.altKey ?? p.alt;
          const hit = hitTest(p.x, p.y);
          const elRect = e.target.getBoundingClientRect(); // measure BEFORE end() resets the transform
          end();

          if (hit?.kind === 'frame') {
            // Adjacent slide: convert the screen position into that slide's artboard units.
            const ab = hit.node.querySelector('.artboard').getBoundingClientRect();
            const bbox = {
              ...old,
              x: (elRect.left - ab.left) / scale,
              y: (elRect.top - ab.top) / scale,
            };
            dispatch(
              {
                type: 'move_element',
                elementId: id,
                toSlideId: hit.slideId,
                newId: copy ? newElementId() : undefined,
                bbox,
              },
              copy ? 'Copy element to slide' : 'Move element to slide',
            );
          } else if (hit?.kind === 'thumb') {
            // Thumbnail: no precise point, so a free spot near the old position, shrinking if
            // needed; on a full slide the elements in the way give up room (D61, D63). Resolved
            // here (D24); one dispatch, one undo step.
            const target = getDeckState().deck.slides[hit.slideId];
            const fit = fitOnSlide(target, [old]);
            dispatch(
              [
                {
                  type: 'move_element',
                  elementId: id,
                  toSlideId: hit.slideId,
                  newId: copy ? newElementId() : undefined,
                  bbox: fit.boxes[0],
                },
                ...makeRoomOps(fit),
              ],
              copy ? 'Copy element to slide' : 'Move element to slide',
            );
          } else {
            dispatch(
              {
                type: 'move_element',
                elementId: id,
                bbox: { ...old, x: old.x + tx, y: old.y + ty },
              },
              'Move element',
            );
          }
        }}
        /* ---- group drag (multi-select, or a group) ----
           Same drop rules as a single drag (D54): onto another slide's frame each element lands
           where it was released; onto a thumbnail the group keeps its arrangement in the nearest
           free spot; either way the group is shifted inside the artboard as one piece. Alt
           copies (the copies form a new group). One dispatch = one undo step. */
        onDragGroupStart={(e) => begin(e.events.map((ev) => ev.target))}
        onDragGroup={(e) => {
          if (gesture.current?.cancelled) return;
          const copy = !!e.inputEvent?.altKey;
          gesture.current.pointer = { x: e.clientX, y: e.clientY, alt: copy };
          e.events.forEach((ev) => {
            ev.target.style.transform = ev.transform;
          });
          const hit = hitTest(e.clientX, e.clientY);
          getDeckState().setDropTarget(hit?.slideId ?? null, copy);
          setBadge(hit ? { x: e.clientX, y: e.clientY, copy } : null);
        }}
        onDragGroupEnd={(e) => {
          const g = gesture.current;
          if (!g || g.cancelled) return end();
          if (!e.isDrag) {
            end();
            clickInSelection(slide, targets, e);
            return;
          }
          const p = g.pointer ?? { x: e.clientX, y: e.clientY, alt: false };
          const copy = e.inputEvent?.altKey ?? p.alt;
          const hit = hitTest(p.x, p.y);
          const members = e.events.map((ev) => ({
            id: ev.target.dataset.elId,
            old: bboxOf(ev.target),
            delta: ev.lastEvent?.beforeTranslate ?? [0, 0],
            rect: ev.target.getBoundingClientRect(), // measure BEFORE end() resets the transforms
          }));
          end();

          if (!hit) {
            const ops = members.map((m) => ({
              type: 'move_element',
              elementId: m.id,
              bbox: { ...m.old, x: m.old.x + m.delta[0], y: m.old.y + m.delta[1] },
            }));
            dispatch(ops, `Move ${ops.length} elements`);
            return;
          }

          let boxes;
          let roomOps = [];
          if (hit.kind === 'frame') {
            // Release point on the other slide, converted into its artboard units.
            const ab = hit.node.querySelector('.artboard').getBoundingClientRect();
            const dropped = members.map((m) => ({
              ...m.old,
              x: (m.rect.left - ab.left) / scale,
              y: (m.rect.top - ab.top) / scale,
            }));
            boxes = shiftGroup(dropped, 0, 0);
          } else {
            const target = getDeckState().deck.slides[hit.slideId];
            const fit = fitOnSlide(
              target,
              members.map((m) => m.old),
            );
            boxes = fit.boxes;
            roomOps = makeRoomOps(fit);
          }

          const els = members.map((m) => slide.elements[m.id]);
          const groups = copy ? remapGroups(els, newGroupId) : {};
          const ops = [];
          members.forEach((m, i) => {
            const newId = copy ? newElementId() : undefined;
            ops.push({
              type: 'move_element',
              elementId: m.id,
              toSlideId: hit.slideId,
              newId,
              bbox: boxes[i],
            });
            const gid = els[i]?.groupId;
            if (copy && gid)
              ops.push({
                type: 'update_element',
                elementId: newId,
                patch: { groupId: groups[gid] },
              });
          });
          ops.push(...roomOps);
          const n = members.length;
          dispatch(ops, copy ? `Copy ${n} elements to slide` : `Move ${n} elements to slide`);
        }}
        /* ---- resize ---- */
        onResizeStart={(e) => begin([e.target])}
        onResize={(e) => {
          if (gesture.current?.cancelled) return;
          e.target.style.width = `${e.width}px`;
          e.target.style.height = `${e.height}px`;
          e.target.style.transform = e.drag.transform;
        }}
        onResizeEnd={(e) => {
          const g = gesture.current;
          if (!g || g.cancelled || !e.lastEvent) return end();
          const { width, height, drag } = e.lastEvent;
          const [tx, ty] = drag.beforeTranslate;
          const old = bboxOf(e.target);
          const id = e.target.dataset.elId;
          end();
          dispatch(
            {
              type: 'update_element',
              elementId: id,
              patch: { bbox: { ...old, x: old.x + tx, y: old.y + ty, w: width, h: height } },
            },
            'Resize element',
          );
        }}
      />
      {badge && (
        <div className="drop-badge" style={{ left: badge.x + 16, top: badge.y + 16 }}>
          {badge.copy ? 'Copying' : 'Hold Alt to copy'} · Esc to cancel
        </div>
      )}
    </>
  );
}
