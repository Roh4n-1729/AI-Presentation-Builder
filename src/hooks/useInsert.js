import { useCallback } from 'react';
import { ARTBOARD_W } from '@/lib/constants.js';
import { starterElement } from '@/lib/factories.js';
import { imageBoxSize, prepareImageFile } from '@/services/images.js';
import { appStore } from '@/store/index.js';
import * as actions from '@/store/actions.js';

const LABELS = {
  title: 'Insert title',
  text: 'Insert text',
  bullets: 'Insert list',
  'chart-bar': 'Insert chart',
  'chart-line': 'Insert chart',
  'chart-pie': 'Insert chart',
  table: 'Insert table',
};

/**
 * An image file (upload, or pasted from the clipboard) as a new image element on the active
 * slide: downscaled, centred in the content area at its own aspect ratio, moved if that spot is
 * taken.
 */
export async function insertImageFromFile(file, label = 'Insert image') {
  const img = await prepareImageFile(file);
  const size = imageBoxSize(img.width, img.height);
  const bbox = { x: Math.round((ARTBOARD_W - size.w) / 2), y: 300, ...size };
  return actions.insertElement(
    appStore,
    { type: 'image', src: img.src, alt: img.alt, fit: 'contain', bbox },
    label,
  );
}

/** Insert menu actions: starter elements, and images from a file or a URL. */
export function useInsert() {
  const insert = useCallback((kind) => {
    const id = actions.insertElement(
      appStore,
      starterElement(kind),
      LABELS[kind] ?? 'Insert shape',
    );
    // A new chart or table opens straight into its data editor.
    if (id && (kind.startsWith('chart') || kind === 'table')) appStore.getState().openDrawer(id);
    return id;
  }, []);

  const insertImageFile = useCallback((file) => insertImageFromFile(file), []);

  const insertImageUrl = useCallback(
    (url) =>
      actions.insertElement(
        appStore,
        { type: 'image', src: url, alt: '', fit: 'cover' },
        'Insert image',
      ),
    [],
  );

  /** Replace the picture of an existing image element (keeps its box). */
  const replaceImageFile = useCallback(async (elementId, file) => {
    const img = await prepareImageFile(file);
    return actions.patchElement(
      appStore,
      elementId,
      // A new picture starts uncropped: the old crop was for the old picture's shape.
      { src: img.src, alt: img.alt, crop: null, natural: null, credit: null },
      'Replace image',
    );
  }, []);

  return { insert, insertImageFile, insertImageUrl, replaceImageFile };
}
