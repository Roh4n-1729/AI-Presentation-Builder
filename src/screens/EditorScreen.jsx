import { SlideColumn } from '@/features/canvas/SlideColumn.jsx';
import { ChatPanel } from '@/features/chat/ChatPanel.jsx';
import { EditorDrawer } from '@/features/drawer/EditorDrawer.jsx';
import { Filmstrip, FILMSTRIP_W } from '@/features/filmstrip/Filmstrip.jsx';
import { PanelSlot } from '@/features/sidepanel/PanelSlot.jsx';
import { PrintView } from '@/features/present/PrintView.jsx';
import { OpErrorToast } from '@/features/topbar/OpErrorToast.jsx';
import { TopBar } from '@/features/topbar/TopBar.jsx';
import { useDeck } from '@/hooks/useDeck.js';
import { useClipboard } from '@/hooks/useClipboard.js';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts.js';

/** Editor layout: top bar · filmstrip | slide column | chat. */
export function EditorScreen() {
  useKeyboardShortcuts();
  useClipboard();
  const panels = useDeck((s) => s.panels);
  const sideWidth = useDeck((s) => s.sideWidth);
  const drawerOpen = useDeck((s) => Boolean(s.drawer));
  const printing = useDeck((s) => s.printing);
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <PanelSlot open={panels.filmstrip} width={FILMSTRIP_W} side="left">
          <Filmstrip />
        </PanelSlot>
        <SlideColumn />
        <PanelSlot open={panels.chat} width={sideWidth} side="right">
          {drawerOpen ? <EditorDrawer /> : <ChatPanel />}
        </PanelSlot>
      </div>
      <OpErrorToast />
      {printing && <PrintView />}
    </div>
  );
}
