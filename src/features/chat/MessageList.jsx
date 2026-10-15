import { useLayoutEffect, useRef } from 'react';
import { useDeck } from '@/hooks/useDeck.js';
import { AssistantMessage } from './AssistantMessage.jsx';

const NEAR_BOTTOM_PX = 80;

/**
 * The conversation. Sticks to the bottom while new content streams in, unless the user has
 * scrolled up to read something (then it stays put).
 */
export function MessageList() {
  const messages = useDeck((s) => s.messages);
  const ref = useRef(null);
  const stick = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const lastAssistant = messages.findLast((m) => m.role === 'assistant')?.id;

  return (
    <div
      ref={ref}
      role="log"
      aria-label="Conversation"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      }}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
    >
      {messages.map((m) =>
        m.role === 'user' ? (
          <div
            key={m.id}
            className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-user-soft px-3 py-2 text-ui whitespace-pre-wrap"
          >
            {m.text}
          </div>
        ) : (
          <AssistantMessage key={m.id} msg={m} isLast={m.id === lastAssistant} />
        ),
      )}
    </div>
  );
}
