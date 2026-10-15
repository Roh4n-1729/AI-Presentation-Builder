import { useState } from 'react';
import { Eraser, Sparkles } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
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
    <aside className="flex w-[360px] shrink-0 flex-col border-l bg-panel" aria-label="AI chat">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-ui font-medium">
        <Sparkles className="size-4 text-ai" strokeWidth={1.5} /> AI
        {hasMessages && (
          <IconButtonTip
            icon={Eraser}
            label="Clear chat"
            className="ml-auto"
            disabled={aiBusy}
            onClick={() => getDeckState().clearChat()}
          />
        )}
      </div>
      {hasMessages ? <MessageList /> : <EmptyChat deckEmpty={deckEmpty} onExample={setDraft} />}
      <Composer draft={draft} setDraft={setDraft} mode={mode} />
    </aside>
  );
}
