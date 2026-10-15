import { useEffect, useRef } from 'react';
import { ChartColumn, Table2, X } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { findElement } from '@/lib/ops/index.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ChartDataEditor } from './ChartDataEditor.jsx';
import { TableEditor } from './TableEditor.jsx';

/**
 * Heavy editors (chart data, table rows/columns) in the right-hand side panel, in place of the AI
 * chat and at the same width. The panel follows the selection: selecting another chart or table
 * switches it, deselecting (or selecting anything else) closes it.
 */
export function EditorDrawer() {
  const elementId = useDeck((s) => s.drawer?.elementId);
  // Select the element itself (a stable reference); a fresh wrapper object would re-render forever.
  const el = useDeck((s) => (elementId ? findElement(s.deck, elementId)?.el : null));
  const selection = useDeck((s) => s.selection);
  const panelRef = useRef(null);

  // Close when the element goes away (deleted, undone, another project opened).
  useEffect(() => {
    if (elementId && !el) getDeckState().closeDrawer();
  }, [elementId, el]);

  // Follow the selection.
  useEffect(() => {
    if (!elementId || selection.includes(elementId)) return;
    const s = getDeckState();
    const only = selection.length === 1 ? findElement(s.deck, selection[0])?.el : null;
    if (only && (only.type === 'chart' || only.type === 'table')) s.openDrawer(only.id);
    else s.closeDrawer();
  }, [selection, elementId]);

  // Opening (or switching) moves focus into the panel, so it's clear where editing happens.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const first = node.querySelector('[data-first-cell]') ?? node.querySelector('input');
    first?.focus({ preventScroll: true });
    first?.select?.();
  }, [elementId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) getDeckState().closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!el) return null;
  const isChart = el.type === 'chart';
  const Icon = isChart ? ChartColumn : Table2;
  const title = isChart ? 'Chart' : 'Table';
  const slideNo = (() => {
    const { deck } = getDeckState();
    const hit = findElement(deck, el.id);
    return hit ? deck.slideOrder.indexOf(hit.slide.id) + 1 : null;
  })();

  return (
    <aside
      ref={panelRef}
      key={el.id /* replays the entrance highlight when switching elements */}
      className="drawer-enter flex w-[360px] shrink-0 flex-col border-l bg-panel"
      aria-label={`${title} editor`}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b pr-2 pl-4 text-ui font-medium">
        <Icon className="size-4 text-user" strokeWidth={1.5} />
        {title}
        {slideNo && <span className="font-normal text-muted-foreground">· slide {slideNo}</span>}
        <IconButtonTip
          icon={X}
          label="Close"
          shortcut="Esc"
          className="ml-auto"
          onClick={() => getDeckState().closeDrawer()}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isChart ? <ChartDataEditor el={el} /> : <TableEditor el={el} />}
      </div>
    </aside>
  );
}
