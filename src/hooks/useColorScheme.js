import { useCallback, useEffect } from 'react';
import { getDeckState, useDeck } from './useDeck.js';

const SCHEME_KEY = 'aipb:theme';
const PANELS_KEY = 'aipb:panels';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode / blocked storage: defaults apply
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not persisted; fine */
  }
};

/**
 * Light/dark for the editor chrome; slides follow it for display (D40). The store holds the
 * scheme so every component (top bar toggle, slide column, filmstrip, start screen) sees one value.
 */
export function useColorScheme() {
  const scheme = useDeck((s) => s.colorScheme);
  const toggle = useCallback(() => {
    const s = getDeckState();
    s.setColorScheme(s.colorScheme === 'dark' ? 'light' : 'dark');
  }, []);
  return { scheme, toggle };
}

/**
 * Mount once (App): keeps <html class="dark"> and localStorage in sync with the store, and
 * restores the panel layout. These are per-browser conveniences, so localStorage is enough.
 */
export function useChromePrefs() {
  const scheme = useDeck((s) => s.colorScheme);
  const panels = useDeck((s) => s.panels);

  useEffect(() => {
    try {
      const saved = JSON.parse(read(PANELS_KEY) ?? 'null');
      if (saved && typeof saved === 'object') {
        const s = getDeckState();
        if (typeof saved.filmstrip === 'boolean') s.setPanel('filmstrip', saved.filmstrip);
        if (typeof saved.chat === 'boolean') s.setPanel('chat', saved.chat);
      }
    } catch {
      /* ignore a malformed value */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', scheme === 'dark');
    write(SCHEME_KEY, scheme);
  }, [scheme]);

  useEffect(() => {
    write(PANELS_KEY, JSON.stringify(panels));
  }, [panels]);
}
