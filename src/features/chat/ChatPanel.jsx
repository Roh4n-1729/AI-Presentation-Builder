import { useState } from 'react';
import { Eraser, Sparkles } from 'lucide-react';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';
import { Composer } from './Composer.jsx';
import { EmptyChat } from './EmptyChat.jsx';
import { MessageList } from './MessageList.jsx';

/**
 * The AI column: conversation + composer. Two modes share one input:
 *   edit      targeted changes to the current deck (/api/agent)
 *   generate  a new deck from a prompt (/api/plan + /api/populate), replacing the current one
 * The draft and mode live here so the empty state's example prompts can fill the composer.
 */
export function ChatPanel() {
  const hasMessages = useDeck((s) => s.messages.length > 0);
  const deckEmpty = useDeck((s) => s.deck.slideOrder.length === 0);
  const aiBusy = useDeck((s) => s.aiBusy);
  const [draft, setDraft] = useState('');
  const [chosenMode, setMode] = useState('edit');
  // An empty deck has nothing to edit: the only sensible mode is generate.
  const mode = deckEmpty ? 'generate' : chosenMode;

  const pickExample = (text, exampleMode) => {
    setMode(exampleMode);
    setDraft(text);
  };

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
      {hasMessages ? <MessageList /> : <EmptyChat deckEmpty={deckEmpty} onExample={pickExample} />}
      <Composer
        draft={draft}
        setDraft={setDraft}
        mode={mode}
        setMode={setMode}
        deckEmpty={deckEmpty}
      />
    </aside>
  );
}
