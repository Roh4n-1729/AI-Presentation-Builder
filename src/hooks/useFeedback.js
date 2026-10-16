import { appStore } from '@/store/index.js';

/*
 * Toasts and modals for any component (D62), in place of window.alert / confirm / prompt:
 *   toast({ kind, title, description, action: { label, onAction } })
 *   await confirm({ title, description, confirmLabel, destructive })   → true / false
 *   await prompt({ title, label, placeholder, defaultValue, validate }) → text / null
 */
const FEEDBACK = {
  toast: (t) => appStore.getState().toast(t),
  error: (title, description) => appStore.getState().toast({ kind: 'error', title, description }),
  dismissToast: (id) => appStore.getState().dismissToast(id),
  confirm: (spec) => appStore.getState().openDialog({ kind: 'confirm', ...spec }),
  prompt: (spec) => appStore.getState().openDialog({ kind: 'prompt', ...spec }),
};

/** Stable object, safe in dependency arrays. */
export const useFeedback = () => FEEDBACK;
