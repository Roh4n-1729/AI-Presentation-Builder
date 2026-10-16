import {
  CloudAlert,
  CloudCheck,
  CloudUpload,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { ColorSchemeToggle } from './ColorSchemeToggle.jsx';
import { ExportMenu } from './ExportMenu.jsx';
import { InsertMenu } from './InsertMenu.jsx';
import { PresentButton } from './PresentButton.jsx';
import { ThemeMenu } from './ThemeMenu.jsx';
import { BrandMark } from '@/primitives/BrandMark.jsx';
import { cn } from '@/primitives/cn.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ToolbarGroup } from '@/primitives/ToolbarGroup.jsx';
import { Button } from '@/primitives/ui/button.jsx';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

/**
 * Editor top bar (D50), three zones on a grid so the middle one is truly centred:
 *   left    panel toggle · mark (home) · deck title in the display serif · save state
 *   centre  the canvas tools: undo/redo, Insert, Theme
 *   right   what leaves the editor (Export, Present, New) · app settings (dark mode, side panel)
 */
export function TopBar() {
  const title = useDeck((s) => s.deck.title);
  // D10: history is paused while an AI run streams (its ops are still landing).
  const aiBusy = useDeck((s) => s.aiBusy);
  const canUndo = useDeck((s) => s.past.length > 0) && !aiBusy;
  const canRedo = useDeck((s) => s.future.length > 0) && !aiBusy;
  const { goToStart } = useWorkspace();
  const panels = useDeck((s) => s.panels);

  return (
    <header className="grid h-13 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b bg-panel px-3">
      <div className="flex min-w-0 items-center gap-1.5">
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
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
        >
          <BrandMark />
        </button>
        <input
          key={title /* re-sync after undo or AI rename */}
          defaultValue={title}
          aria-label="Presentation title"
          title={title}
          className="field-sizing-content max-w-[min(30rem,32vw)] min-w-24 truncate rounded-md bg-transparent px-2 py-1 font-display text-[1.25rem] leading-7 transition-colors duration-fast ease-standard outline-none hover:bg-subtle focus:bg-subtle focus:ring-2 focus:ring-ring/50"
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
        <SaveIndicator />
      </div>

      <div
        role="toolbar"
        aria-label="Edit"
        className="flex items-center gap-0.5 rounded-lg border bg-background px-1 py-0.5"
      >
        <ToolbarGroup>
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
        <ToolbarGroup>
          <InsertMenu />
          <ThemeMenu />
        </ToolbarGroup>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <ExportMenu />
        <PresentButton />
        {/* Below 1280 px the label folds into the icon so the centred tools keep their room. */}
        <Button
          size="sm"
          disabled={aiBusy}
          onClick={goToStart}
          aria-label="New presentation"
          title="New presentation"
          className="px-2.5 xl:px-3.5"
        >
          <Plus strokeWidth={2} />
          <span className="hidden xl:inline">New presentation</span>
        </Button>
        <ToolbarGroup className="ml-1 border-l pl-1.5">
          <ColorSchemeToggle />
          <IconButtonTip
            icon={panels.chat ? PanelRightClose : PanelRightOpen}
            label={panels.chat ? 'Hide side panel' : 'Show side panel'}
            shortcut={`${MOD} ]`}
            onClick={() => getDeckState().setPanel('chat')}
          />
        </ToolbarGroup>
      </div>
    </header>
  );
}

const SAVE_STATE = {
  unsaved: { icon: CloudUpload, label: 'Saving…' },
  saving: { icon: CloudUpload, label: 'Saving…' },
  saved: { icon: CloudCheck, label: 'Saved in this browser' },
  error: { icon: CloudAlert, label: 'Not saved: browser storage unavailable' },
};

/**
 * Autosave state (IndexedDB), as the title's own status: a quiet cloud icon, its full meaning in
 * the tooltip and to screen readers; only the error shows text.
 */
function SaveIndicator() {
  const status = useDeck((s) => s.saveStatus);
  const state = SAVE_STATE[status];
  if (!state) return null;
  const { icon: Icon, label } = state;
  const error = status === 'error';
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        'flex shrink-0 items-center gap-1 text-label',
        error ? 'text-destructive' : 'text-faint',
      )}
    >
      <Icon className="size-4" strokeWidth={1.5} />
      {error && <span>Not saved</span>}
    </span>
  );
}
