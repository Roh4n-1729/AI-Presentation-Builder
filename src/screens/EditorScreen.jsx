import { SlideColumn } from '@/features/canvas/SlideColumn.jsx';
import { ChatPanel } from '@/features/chat/ChatPanel.jsx';
import { EditorDrawer } from '@/features/drawer/EditorDrawer.jsx';
import { Filmstrip } from '@/features/filmstrip/Filmstrip.jsx';
import { PresentMode } from '@/features/present/PresentMode.jsx';
import { PrintView } from '@/features/present/PrintView.jsx';
import { OpErrorToast } from '@/features/topbar/OpErrorToast.jsx';
import { TopBar } from '@/features/topbar/TopBar.jsx';
import { useDeck } from '@/hooks/useDeck.js';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts.js';

/** Editor layout: top bar · filmstrip | slide column | chat. */
export function EditorScreen() {
  useKeyboardShortcuts();
  const panels = useDeck((s) => s.panels);
  const drawerOpen = useDeck((s) => Boolean(s.drawer));
  const presenting = useDeck((s) => Boolean(s.presenting));
  const printing = useDeck((s) => s.printing);
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {panels.filmstrip && <Filmstrip />}
        <SlideColumn />
        {panels.chat && (drawerOpen ? <EditorDrawer /> : <ChatPanel />)}
      </div>
      <OpErrorToast />
      {presenting && <PresentMode />}
      {printing && <PrintView />}
    </div>
  );
}
