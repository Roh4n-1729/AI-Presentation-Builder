import { Sparkles } from 'lucide-react';

/** Placeholder until the agent step: reserves the chat column so the editor layout is final. */
export function ChatPanel() {
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l bg-panel" aria-label="AI chat">
      <div className="flex h-11 items-center gap-2 border-b px-4 text-ui font-medium">
        <Sparkles className="size-4 text-ai" strokeWidth={1.5} /> AI
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-display text-[28px] leading-tight">Chat is coming</p>
        <p className="text-ui text-muted-foreground">
          Generate and refine slides by talking to the AI. Every change it makes lands on this
          canvas.
        </p>
      </div>
    </aside>
  );
}
