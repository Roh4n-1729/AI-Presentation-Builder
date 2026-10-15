import { Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import { useColorScheme } from '@/hooks/useColorScheme.js';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ToolbarGroup } from '@/primitives/ToolbarGroup.jsx';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export function TopBar() {
  const title = useDeck((s) => s.deck.title);
  const canUndo = useDeck((s) => s.past.length > 0);
  const canRedo = useDeck((s) => s.future.length > 0);
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
      <div className="ml-auto">
        <IconButtonTip
          icon={scheme === 'dark' ? Sun : Moon}
          label={scheme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggle}
        />
      </div>
    </header>
  );
}
