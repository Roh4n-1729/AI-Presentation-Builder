/*
 * Image upload (plain browser JS, no React). Photos are downscaled before they enter the deck:
 * the deck lives in IndexedDB and every autosave writes it, so a 12 MP phone photo would make
 * saving slow and the PPTX huge. Images never go to /api (D13, request contract).
 */

export const MAX_IMAGE_DIM = 1600;
const ACCEPTED = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });

/**
 * A File from an <input type=file> or a drop → a data URL no larger than MAX_IMAGE_DIM on its
 * long side (JPEG for photos, PNG kept for PNGs so transparency survives), plus its aspect ratio.
 * @returns {Promise<{ src: string, width: number, height: number, alt: string }>}
 */
export async function prepareImageFile(file) {
  if (!ACCEPTED.test(file.type)) throw new Error('Use a PNG, JPEG, WebP, GIF or SVG image.');
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  const { naturalWidth: w, naturalHeight: h } = img;
  if (file.type === 'image/svg+xml' || Math.max(w, h) <= MAX_IMAGE_DIM)
    return { src: original, width: w || 800, height: h || 600, alt };
  const k = MAX_IMAGE_DIM / Math.max(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { src: canvas.toDataURL(type, 0.85), width: canvas.width, height: canvas.height, alt };
}

/** Box size for an image of this aspect ratio that fits in maxW × maxH artboard units. */
export function imageBoxSize(width, height, maxW = 900, maxH = 600) {
  const k = Math.min(maxW / width, maxH / height);
  return { w: Math.round(width * k), h: Math.round(height * k) };
}
