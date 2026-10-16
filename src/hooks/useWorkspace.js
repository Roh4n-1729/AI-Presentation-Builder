import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { deckPath, HOME_PATH } from '@/lib/routes.js';
import * as workspace from '@/services/workspace.js';
import { appStore } from '@/store/index.js';

/**
 * Workspace actions bound to the app store. Each one does its work, then navigates: the URL is
 * where the app is (D59), so starting or opening a project ends on /deck/:id and going home on /.
 */
export function useWorkspace() {
  const navigate = useNavigate();
  return useMemo(() => {
    const open = (id) => id && navigate(deckPath(id));
    return {
      // Home is disabled while the AI is working (Back still works: leaving stops the run).
      goToStart: () => !appStore.getState().aiBusy && navigate(HOME_PATH),
      openProject: (id) => navigate(deckPath(id)),
      deleteProject: (id) => workspace.deleteProject(appStore, id),
      startBlank: () => workspace.startBlank(appStore).then(open),
      startFromSample: () => workspace.startFromSample(appStore).then(open),
      prepareForGeneration: () => workspace.prepareForGeneration(appStore).then(open),
      importDeckFile: async (file) => {
        const res = await workspace.importDeckFile(appStore, file);
        if (res.ok) open(res.id);
        return res;
      },
    };
  }, [navigate]);
}

/** Saved-projects list, autosave and background services, once at startup. */
export function useWorkspaceBoot() {
  useEffect(() => {
    workspace.bootWorkspace(appStore);
  }, []);
}

/**
 * The project named in the URL: loads it unless it's already open.
 * @returns {'loading' | 'ready' | 'missing'}
 */
export function useProjectRoute(deckId) {
  const [result, setResult] = useState(() => ({
    id: deckId,
    status: workspace.isOpen(appStore, deckId) ? 'ready' : 'loading',
  }));
  const status =
    result.id === deckId ? result.status : workspace.isOpen(appStore, deckId) ? 'ready' : 'loading';
  useEffect(() => {
    if (workspace.isOpen(appStore, deckId)) {
      setResult({ id: deckId, status: 'ready' });
      return undefined;
    }
    let alive = true;
    setResult({ id: deckId, status: 'loading' });
    workspace
      .bootWorkspace(appStore)
      .then(() => workspace.openProject(appStore, deckId))
      .then((ok) => alive && setResult({ id: deckId, status: ok ? 'ready' : 'missing' }));
    return () => {
      alive = false;
    };
  }, [deckId]);
  return status;
}

/** The StartScreen route: close the open project (it stays saved). */
export function useCloseProjectOnMount() {
  useEffect(() => {
    workspace.bootWorkspace(appStore).then(() => workspace.closeProject(appStore));
  }, []);
}
