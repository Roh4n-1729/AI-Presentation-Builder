import { useRef, useState } from 'react';
import Moveable from 'react-moveable';
import { ARTBOARD_H, ARTBOARD_W } from '../lib/constants.js';

/**
 * Throwaway Day-1 check page. Two things to verify after install and after deploy:
 *  1. react-moveable still drags / resizes / snaps on React 19 inside a CSS-scaled artboard
 *     (the spike only proved it on React 18).
 *  2. /api/sse-test streams events one by one (not buffered) and Stop aborts the request.
 * Deleted when the real editor replaces App.
 */
const SCALE = 0.4;

function MoveableCheck() {
  const boxRef = useRef(null);
  const guideRef = useRef(null);
  const artboardRef = useRef(null);
  const [bbox, setBbox] = useState({ x: 200, y: 200, w: 480, h: 300 });
  const [log, setLog] = useState('idle');

  return (
    <section>
      <h2 style={{ fontSize: 16 }}>1 · Moveable on React 19 (scaled artboard)</h2>
      <p style={{ fontSize: 13, color: '#6b6b6b' }}>
        Drag and resize the indigo box; guides should appear when aligned with the grey box or the
        artboard edges. Store write happens only on release.
      </p>
      <div
        style={{
          position: 'relative',
          width: ARTBOARD_W * SCALE,
          height: ARTBOARD_H * SCALE,
          boxShadow: '0 0 0 1px #e6e6e6',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: ARTBOARD_W,
            height: ARTBOARD_H,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
          }}
        >
          <div
            ref={artboardRef}
            style={{ position: 'absolute', inset: 0, background: '#fff', userSelect: 'none' }}
          >
            <div
              ref={guideRef}
              style={{
                position: 'absolute',
                left: 1100,
                top: 500,
                width: 500,
                height: 350,
                background: '#ededed',
              }}
            />
            <div
              ref={boxRef}
              data-testid="moveable-box"
              style={{
                position: 'absolute',
                left: bbox.x,
                top: bbox.y,
                width: bbox.w,
                height: bbox.h,
                background: '#4250d5',
                cursor: 'move',
              }}
            />
          </div>
        </div>
        <Moveable
          target={boxRef}
          draggable
          resizable
          snappable
          snapThreshold={8}
          elementGuidelines={[guideRef, artboardRef]}
          snapDirections={{
            top: true,
            left: true,
            bottom: true,
            right: true,
            center: true,
            middle: true,
          }}
          elementSnapDirections={{
            top: true,
            left: true,
            bottom: true,
            right: true,
            center: true,
            middle: true,
          }}
          origin={false}
          onDrag={(e) => {
            e.target.style.transform = e.transform;
          }}
          onDragEnd={(e) => {
            if (!e.lastEvent) return;
            const [tx, ty] = e.lastEvent.beforeTranslate;
            e.target.style.transform = '';
            setBbox((b) => ({ ...b, x: Math.round(b.x + tx), y: Math.round(b.y + ty) }));
            setLog('drag committed');
          }}
          onResize={(e) => {
            e.target.style.width = `${e.width}px`;
            e.target.style.height = `${e.height}px`;
            e.target.style.transform = e.drag.transform;
          }}
          onResizeEnd={(e) => {
            if (!e.lastEvent) return;
            const { width, height, drag } = e.lastEvent;
            const [tx, ty] = drag.beforeTranslate;
            e.target.style.transform = '';
            setBbox((b) => ({
              x: Math.round(b.x + tx),
              y: Math.round(b.y + ty),
              w: Math.round(width),
              h: Math.round(height),
            }));
            setLog('resize committed');
          }}
        />
      </div>
      <pre data-testid="bbox" style={{ fontSize: 12 }}>
        bbox (artboard units): {JSON.stringify(bbox)} · {log}
      </pre>
    </section>
  );
}

function SseCheck() {
  const [lines, setLines] = useState([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(null);

  const run = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setLines([]);
    setRunning(true);
    const t0 = performance.now();
    const add = (text) =>
      setLines((l) => [...l, `+${Math.round(performance.now() - t0)}ms  ${text}`]);
    try {
      const res = await fetch('/api/sse-test', { method: 'POST', signal: controller.signal });
      add(`HTTP ${res.status} ${res.headers.get('content-type')}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        add(JSON.stringify(value));
      }
      add('stream closed');
    } catch (err) {
      add(
        err.name === 'AbortError' ? 'stopped by client (AbortController)' : `error: ${err.message}`,
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: 16 }}>2 · SSE streaming from /api/sse-test</h2>
      <p style={{ fontSize: 13, color: '#6b6b6b' }}>
        Pass: ticks arrive ~400ms apart. Fail: everything arrives at once at the end (buffered).
      </p>
      <button onClick={run} disabled={running}>
        Run SSE test
      </button>{' '}
      <button onClick={() => abortRef.current?.abort()} disabled={!running}>
        Stop
      </button>
      <pre data-testid="sse-log" style={{ fontSize: 12, background: '#f5f5f5', padding: 8 }}>
        {lines.join('\n') || 'not run yet'}
      </pre>
    </section>
  );
}

export default function ScaffoldCheck() {
  return (
    <main style={{ padding: 24, display: 'grid', gap: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>AI Presentation Builder · scaffold check</h1>
      <MoveableCheck />
      <SseCheck />
    </main>
  );
}
