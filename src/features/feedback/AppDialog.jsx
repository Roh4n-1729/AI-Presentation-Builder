import { useEffect, useState } from 'react';
import { motionMs } from '@/hooks/motion.js';
import { getDeckState, useDeck } from '@/hooks/useDeck.js';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/primitives/ui/alert-dialog.jsx';
import { Button } from '@/primitives/ui/button.jsx';

const cancelOpenDialog = () => {
  const d = getDeckState().dialog;
  if (d) getDeckState().closeDialog(d.kind === 'prompt' ? null : false);
};

/**
 * The app's one modal (D62): a confirmation or a single text field, opened through
 * `useFeedback().confirm / prompt`, which wait for the answer. Replaces window.confirm / prompt.
 *
 * The Radix root stays mounted and is closed through `open` (D66). Unmounting it while open (the
 * first version did, on every answer) skips Radix's close sequence, which can leave the page's
 * scroll lock and `pointer-events: none` on <body>: everything behind looks fine but can't be
 * clicked until a reload. The last request is kept so the content can animate out.
 */
export function AppDialog() {
  const dialog = useDeck((s) => s.dialog);
  const [shown, setShown] = useState(dialog);
  if (dialog && dialog !== shown) setShown(dialog); // adjust state while rendering (React docs)
  useReleaseBodyAfterClose(Boolean(dialog));
  return (
    <AlertDialog open={Boolean(dialog)} onOpenChange={(open) => !open && cancelOpenDialog()}>
      {shown && (
        // Keyed by the request, so a new dialog starts with fresh field state.
        <DialogBody key={shown.title + (shown.defaultValue ?? '')} dialog={shown} />
      )}
    </AlertDialog>
  );
}

/**
 * Safety net (D66): once the dialog has closed and its exit animation is over, if nothing modal is
 * still open, make sure no lock was left on <body>.
 */
function useReleaseBodyAfterClose(open) {
  useEffect(() => {
    if (open) return undefined;
    const t = setTimeout(
      () => {
        const modalOpen = document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]',
        );
        if (modalOpen) return;
        if (document.body.style.pointerEvents === 'none') document.body.style.pointerEvents = '';
        document.body.removeAttribute('data-scroll-locked');
      },
      motionMs('emphasis') + 50,
    );
    return () => clearTimeout(t);
  }, [open]);
}

function DialogBody({ dialog }) {
  const [value, setValue] = useState(dialog.defaultValue ?? '');
  const [error, setError] = useState('');
  const isPrompt = dialog.kind === 'prompt';
  const accept = (e) => {
    e?.preventDefault();
    if (!isPrompt) return getDeckState().closeDialog(true);
    const text = value.trim();
    const problem = dialog.validate?.(text) ?? (text ? '' : 'Enter a value.');
    if (problem) return setError(problem);
    getDeckState().closeDialog(text);
  };

  return (
    <AlertDialogContent onOverlayClick={cancelOpenDialog}>
      <form onSubmit={accept} className="grid gap-4">
        <div className="grid gap-1.5">
          <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
          {dialog.description && (
            <AlertDialogDescription>{dialog.description}</AlertDialogDescription>
          )}
        </div>
        {isPrompt && (
          <label className="grid gap-1.5">
            <span className="text-label text-muted-foreground">{dialog.label}</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              placeholder={dialog.placeholder}
              aria-invalid={Boolean(error) || undefined}
              className="h-9 rounded-md border bg-background px-3 text-ui outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            />
            {error && <span className="text-label text-destructive">{error}</span>}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </AlertDialogCancel>
          {/* A plain submit button, not AlertDialog.Action: Action closes the dialog first, and
                closing counts as Cancel (and would skip the prompt's validation). */}
          <Button
            type="submit"
            size="sm"
            variant={dialog.destructive ? 'destructive' : 'default'}
            autoFocus={!isPrompt && !dialog.destructive}
          >
            {dialog.confirmLabel ?? 'OK'}
          </Button>
        </div>
      </form>
    </AlertDialogContent>
  );
}
