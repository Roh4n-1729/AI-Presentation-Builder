import {
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Redo2,
  Sun,
  Undo2,
} from 'lucide-react';
import { useColorScheme } from '@/hooks/useColorScheme.js';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { useExport } from '@/hooks/useExport.js';
import { ExportMenu } from './ExportMenu.jsx';
import { InsertMenu } from './InsertMenu.jsx';
import { ThemeMenu } from './ThemeMenu.jsx';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ToolbarGroup } from '@/primitives/ToolbarGroup.jsx';
import { Button } from '@/primitives/ui/button.jsx';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export function TopBar() {
  const title = useDeck((s) => s.deck.title);
  // D10: history is paused while an AI run streams (its ops are still landing).
  const aiBusy = useDeck((s) => s.aiBusy);
  const canUndo = useDeck((s) => s.past.length > 0) && !aiBusy;
  const canRedo = useDeck((s) => s.future.length > 0) && !aiBusy;
  const { goToStart } = useWorkspace();
  const panels = useDeck((s) => s.panels);
  const hasSlides = useDeck((s) => s.deck.slideOrder.length > 0);
  const { present } = useExport();
  const { scheme, toggle } = useColorScheme();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-panel px-3">
      <IconButtonTip
        icon={panels.filmstrip ? PanelLeftClose : PanelLeftOpen}
        label={panels.filmstrip ? 'Hide slides panel' : 'Show slides panel'}
        shortcut={`${MOD} [`}
        onClick={() => getDeckState().setPanel('filmstrip')}
      />
      <button
        type="button"
        onClick={goToStart}
        disabled={aiBusy}
        aria-label="All presentations"
        title="All presentations"
        className="flex size-7 items-center justify-center rounded-md bg-user text-label font-semibold text-white transition-opacity duration-120 hover:opacity-90 disabled:opacity-60"
      >
        AI
      </button>
      <input
        key={title /* re-sync after undo or AI rename */}
        defaultValue={title}
        aria-label="Presentation title"
        title={title}
        className="w-[clamp(12rem,28vw,30rem)] min-w-0 truncate rounded-sm bg-transparent px-1.5 py-1 text-sm font-medium outline-none hover:bg-subtle focus:bg-panel focus:ring-2 focus:ring-ring/50"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            e.currentTarget.value = title;
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const next = e.currentTarget.value.trim();
          if (next && next !== title) {
            getDeckState().dispatch(
              { type: 'update_deck', patch: { title: next } },
              { label: 'Rename deck' },
            );
          } else e.currentTarget.value = title;
        }}
      />
      <ToolbarGroup className="ml-2">
        <IconButtonTip
          icon={Undo2}
          label="Undo"
          shortcut={`${MOD} Z`}
          disabled={!canUndo}
          onClick={() => getDeckState().undo()}
        />
        <IconButtonTip
          icon={Redo2}
          label="Redo"
          shortcut={`${MOD} Y`}
          disabled={!canRedo}
          onClick={() => getDeckState().redo()}
        />
      </ToolbarGroup>
      <InsertMenu />
      <SaveIndicator />
      <div className="ml-auto flex items-center gap-1">
        <ThemeMenu />
        <ExportMenu />
        <Button
          size="sm"
          variant="secondary"
          disabled={!hasSlides}
          onClick={() => present(false)}
          title="Present from this slide (Shift+F5; F5 from the start)"
        >
          <Play strokeWidth={1.75} /> Present
        </Button>
        <Button size="sm" disabled={aiBusy} onClick={goToStart} className="px-3.5">
          <Plus strokeWidth={2} /> New presentation
        </Button>
        <IconButtonTip
          icon={scheme === 'dark' ? Sun : Moon}
          label={scheme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggle}
        />
        <IconButtonTip
          icon={panels.chat ? PanelRightClose : PanelRightOpen}
          label={panels.chat ? 'Hide side panel' : 'Show side panel'}
          shortcut={`${MOD} ]`}
          onClick={() => getDeckState().setPanel('chat')}
        />
      </div>
    </header>
  );
}

const SAVE_LABEL = {
  unsaved: 'Saving…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved: browser storage unavailable',
};

/** Autosave state (IndexedDB). Quiet when all is well; red when saving failed. */
function SaveIndicator() {
  const status = useDeck((s) => s.saveStatus);
  const label = SAVE_LABEL[status];
  if (!label) return null;
  return (
    <span
      aria-live="polite"
      className={status === 'error' ? 'text-label text-destructive' : 'text-label text-faint'}
    >
      {label}
    </span>
  );
}
