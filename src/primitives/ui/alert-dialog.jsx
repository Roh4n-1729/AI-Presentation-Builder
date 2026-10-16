import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { cn } from '@/primitives/cn';

/*
 * Modal confirmation (D62), on Radix AlertDialog: focus is trapped and returned, Esc cancels,
 * screen readers announce it as an alert dialog. Styled with the design-system tokens.
 */

function AlertDialog(props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

/** `onOverlayClick`: clicking the dimmed background (AlertDialog itself ignores outside clicks). */
function AlertDialogContent({ className, children, onOverlayClick, ...props }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        onClick={onOverlayClick}
        className="fixed inset-0 z-50 bg-black/40 duration-base ease-standard data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-panel p-6 text-ui shadow-float duration-base ease-enter data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogTitle({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-base font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-ui text-muted-foreground', className)}
      {...props}
    />
  );
}

const AlertDialogCancel = AlertDialogPrimitive.Cancel;
const AlertDialogAction = AlertDialogPrimitive.Action;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
};
