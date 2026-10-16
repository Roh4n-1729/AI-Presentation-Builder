import { useEffect } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { Toast } from 'radix-ui';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import { cn } from '@/primitives/cn.js';

const ICON = { success: CircleCheck, error: CircleAlert, info: Info };
const TONE = { success: 'text-success', error: 'text-destructive', info: 'text-user' };

/**
 * Toasts (D62) on Radix Toast: announced to screen readers, paused while hovered or focused,
 * swipe or Esc (F8 focuses the region) to dismiss. Bottom centre, newest last, at most three.
 * Rejected edits (`lastError`, e.g. "Element is locked") show here too.
 */
export function Toaster() {
  const toasts = useDeck((s) => s.toasts);
  const lastError = useDeck((s) => s.lastError);

  useEffect(() => {
    if (!lastError) return;
    const s = getDeckState();
    // The op's message is for the AI and logs ("Element el_x is locked"); people get plain words.
    const description =
      lastError.code === 'LOCKED'
        ? "It's locked. Unlock it from the toolbar first."
        : lastError.message;
    s.toast({ kind: 'error', title: `${lastError.label} failed`, description });
    s.clearError();
  }, [lastError]);

  return (
    <Toast.Provider swipeDirection="down" label="Notifications">
      {toasts.map((t) => {
        const Icon = ICON[t.kind] ?? Info;
        return (
          <Toast.Root
            key={t.id}
            type={t.kind === 'error' ? 'foreground' : 'background'}
            duration={t.duration}
            onOpenChange={(open) => !open && getDeckState().dismissToast(t.id)}
            className="flex w-full items-start gap-2.5 rounded-lg border bg-panel px-3.5 py-2.5 text-ui shadow-float duration-base ease-enter data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0 data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y)"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[t.kind])} strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <Toast.Title className="font-medium text-foreground">{t.title}</Toast.Title>
              {t.description && (
                <Toast.Description className="mt-0.5 text-muted-foreground">
                  {t.description}
                </Toast.Description>
              )}
            </div>
            {t.action && (
              <Toast.Action
                altText={t.action.label}
                onClick={t.action.onAction}
                className="shrink-0 rounded-md px-2 py-0.5 font-medium text-user hover:bg-subtle"
              >
                {t.action.label}
              </Toast.Action>
            )}
            <Toast.Close
              aria-label="Dismiss"
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.5} />
            </Toast.Close>
          </Toast.Root>
        );
      })}
      <Toast.Viewport className="fixed bottom-5 left-1/2 z-[60] flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}
