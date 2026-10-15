import { SlideColumn } from '@/features/canvas/SlideColumn.jsx';
import { ChatPanel } from '@/features/chat/ChatPanel.jsx';
import { Filmstrip } from '@/features/filmstrip/Filmstrip.jsx';
import { OpErrorToast } from '@/features/topbar/OpErrorToast.jsx';
import { TopBar } from '@/features/topbar/TopBar.jsx';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts.js';

/** Editor layout: top bar · filmstrip | slide column | chat. */
export function EditorScreen() {
  useKeyboardShortcuts();
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Filmstrip />
        <SlideColumn />
        <ChatPanel />
      </div>
      <OpErrorToast />
    </div>
  );
}
