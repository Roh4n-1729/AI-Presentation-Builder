import { useEffect } from 'react';
import * as workspace from '@/services/workspace.js';
import { appStore } from '@/store/index.js';

const BOUND = {
  newPresentation: () => workspace.newPresentation(appStore),
  startBlank: () => workspace.startBlank(appStore),
  startFromSample: () => workspace.startFromSample(appStore),
};

/** Workspace actions (start blank / from sample / new) bound to the app store. */
export const useWorkspace = () => BOUND;

/** Restore the saved deck and chat (or pick the StartScreen) once, then autosave. */
export function useWorkspaceBoot() {
  useEffect(() => {
    workspace.bootWorkspace(appStore);
  }, []);
}
