import { useCallback, useEffect, useState } from 'react';

const KEY = 'aipb:theme';

/**
 * Light/dark for the editor chrome (slides keep their own theme). The initial class is set by an
 * inline script in index.html before first paint; this hook keeps React state in sync and persists
 * the user's choice. Storage can throw (private mode, blocked site data), so every access is guarded.
 */
export function useColorScheme() {
  const [scheme, setScheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', scheme === 'dark');
    try {
      localStorage.setItem(KEY, scheme);
    } catch {
      /* not persisted; fine */
    }
  }, [scheme]);

  const toggle = useCallback(() => setScheme((s) => (s === 'dark' ? 'light' : 'dark')), []);
  return { scheme, toggle };
}
