import { useEffect } from 'react';
import * as workspace from '@/services/workspace.js';
import { appStore } from '@/store/index.js';

const BOUND = {
  goToStart: () => workspace.goToStart(appStore),
  openProject: (id) => workspace.openProject(appStore, id),
  deleteProject: (id) => workspace.deleteProject(appStore, id),
  startBlank: () => workspace.startBlank(appStore),
  startFromSample: () => workspace.startFromSample(appStore),
  prepareForGeneration: () => workspace.prepareForGeneration(appStore),
  importDeckFile: (file) => workspace.importDeckFile(appStore, file),
};

/** Workspace actions (projects, start blank / from sample, back to start) bound to the app store. */
export const useWorkspace = () => BOUND;

/** Restore the open project (or show the StartScreen) once, then autosave. */
export function useWorkspaceBoot() {
  useEffect(() => {
    workspace.bootWorkspace(appStore);
  }, []);
}
