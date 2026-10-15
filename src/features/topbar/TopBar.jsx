import { Moon, Plus, Redo2, Sun, Undo2 } from 'lucide-react';
import { useColorScheme } from '@/hooks/useColorScheme.js';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { useWorkspace } from '@/hooks/useWorkspace.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ToolbarGroup } from '@/primitives/ToolbarGroup.jsx';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export function TopBar() {
  const title = useDeck((s) => s.deck.title);
  // D10: history is paused while an AI run streams (its ops are still landing).
  const aiBusy = useDeck((s) => s.aiBusy);
  const canUndo = useDeck((s) => s.past.length > 0) && !aiBusy;
  const canRedo = useDeck((s) => s.future.length > 0) && !aiBusy;
  const { newPresentation } = useWorkspace();
  const { scheme, toggle } = useColorScheme();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-panel px-3">
      <div className="flex size-7 items-center justify-center rounded-md bg-user text-label font-semibold text-white">
        AI
      </div>
      <input
        key={title /* re-sync after undo or AI rename */}
        defaultValue={title}
        aria-label="Presentation title"
        className="w-72 rounded-sm bg-transparent px-1.5 py-1 text-sm font-medium outline-none hover:bg-subtle focus:bg-panel focus:ring-2 focus:ring-ring/50"
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
      <SaveIndicator />
      <div className="ml-auto flex items-center gap-1">
        <IconButtonTip
          icon={Plus}
          label="New presentation"
          disabled={aiBusy}
          onClick={() => {
            const empty =
              getDeckState().deck.slideOrder.length === 0 && getDeckState().messages.length === 0;
            if (
              empty ||
              window.confirm('Start a new presentation? The current deck and chat will be cleared.')
            )
              newPresentation();
          }}
        />
        <IconButtonTip
          icon={scheme === 'dark' ? Sun : Moon}
          label={scheme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggle}
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
