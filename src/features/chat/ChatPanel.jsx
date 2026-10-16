import { useState } from 'react';
import { Eraser, Sparkles } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { ExpandPanelButton, SidePanel } from '@/features/sidepanel/SidePanel.jsx';
import { Composer } from './Composer.jsx';
import { EmptyChat } from './EmptyChat.jsx';
import { MessageList } from './MessageList.jsx';

/**
 * The AI column: conversation + composer. The chat edits the open deck (/api/agent); when the deck
 * is empty it builds it instead (/api/plan + /api/populate). New presentations start from the
 * top bar's "New" button (D40). The draft lives here so example prompts can fill the composer.
 */
export function ChatPanel() {
  const hasMessages = useDeck((s) => s.messages.length > 0);
  const deckEmpty = useDeck((s) => s.deck.slideOrder.length === 0);
  const aiBusy = useDeck((s) => s.aiBusy);
  const [draft, setDraft] = useState('');
  // The chat edits the open deck; an empty deck ("Start blank") is built from the chat instead.
  const mode = deckEmpty ? 'generate' : 'edit';

  return (
    <SidePanel aria-label="AI chat">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b pr-2 pl-4 text-ui font-medium">
        <Sparkles className="mr-1 size-4 text-ai" strokeWidth={1.5} /> AI
        <span className="ml-auto" />
        {hasMessages && (
          <IconButtonTip
            icon={Eraser}
            label="Clear chat"
            disabled={aiBusy}
            onClick={() => getDeckState().clearChat()}
          />
        )}
        <ExpandPanelButton />
      </div>
      {hasMessages ? <MessageList /> : <EmptyChat deckEmpty={deckEmpty} onExample={setDraft} />}
      <Composer draft={draft} setDraft={setDraft} mode={mode} />
    </SidePanel>
  );
}
