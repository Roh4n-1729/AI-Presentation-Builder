/**
 * Image crop geometry (D53), shared by the renderer, the crop editor and the PowerPoint export.
 * A crop is a rectangle in fractions of the source image: { x, y, w, h } in 0..1.
 */

const MIN = 0.05; // smallest crop side, as a fraction of the image

/**
 * The crop that shows what "fill the box" (object-fit: cover) shows today: the largest centred
 * region with the box's aspect ratio. Starting point of the crop editor.
 * @param {{ w: number, h: number }} natural  source size in px
 * @param {number} aspect  box width / height
 */
export function coverCrop(natural, aspect) {
  const imgAspect = natural.w / natural.h;
  if (imgAspect > aspect) {
    const w = aspect / imgAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = imgAspect / aspect;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** Height fraction that gives a crop of width fraction `w` the box's aspect ratio. */
const heightFor = (w, natural, aspect) => (w * natural.w) / (aspect * natural.h);

/** Keep a crop inside the image and at least MIN on each side, keeping its aspect ratio. */
export function clampCrop(c, natural, aspect) {
  const maxW = Math.min(1, aspect * (natural.h / natural.w)); // widest that still fits in height
  let w = Math.min(Math.max(c.w, MIN), maxW);
  let h = heightFor(w, natural, aspect);
  if (h < MIN) {
    h = MIN;
    w = (h * aspect * natural.h) / natural.w;
  }
  const x = Math.min(Math.max(c.x, 0), 1 - w);
  const y = Math.min(Math.max(c.y, 0), 1 - h);
  return { x, y, w, h };
}

/** Resize a crop by moving one corner; the opposite corner stays put, the aspect is kept. */
export function resizeCrop(c, corner, dxFraction, natural, aspect) {
  const grow = corner.includes('e') ? dxFraction : -dxFraction;
  let w = c.w + grow;
  const maxW = Math.min(
    1,
    aspect * (natural.h / natural.w),
    corner.includes('e') ? 1 - c.x : c.x + c.w, // room toward the moving side
  );
  w = Math.min(Math.max(w, MIN), maxW);
  let h = heightFor(w, natural, aspect);
  const roomY = corner.includes('s') ? 1 - c.y : c.y + c.h;
  if (h > roomY) {
    h = roomY;
    w = (h * aspect * natural.h) / natural.w;
  }
  const x = corner.includes('e') ? c.x : c.x + c.w - w;
  const y = corner.includes('s') ? c.y : c.y + c.h - h;
  return { x, y, w, h };
}

/** Scale a crop around its centre (zoom in < 1 < zoom out), kept inside the image. */
export function zoomCrop(c, factor, natural, aspect) {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const w = c.w * factor;
  const h = heightFor(w, natural, aspect);
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h }, natural, aspect);
}

/**
 * Where to draw the source so the crop region covers (or fits in) a W×H box. Returns the region's
 * rect in the box (`clip`) and the whole image's rect relative to that region (`img`), in px.
 */
export function cropLayout(crop, natural, W, H, fit = 'cover') {
  const cw = crop.w * natural.w;
  const ch = crop.h * natural.h;
  const s = fit === 'contain' ? Math.min(W / cw, H / ch) : Math.max(W / cw, H / ch);
  return {
    clip: { left: (W - cw * s) / 2, top: (H - ch * s) / 2, width: cw * s, height: ch * s },
    img: {
      left: -crop.x * natural.w * s,
      top: -crop.y * natural.h * s,
      width: natural.w * s,
      height: natural.h * s,
    },
  };
}
