// Every slide is authored in this fixed logical space, then CSS-scaled to fit the screen.
// 1920 / 144 = 13.333in -> the exact width of a 16:9 PowerPoint slide (export: 144 units per inch).
export const ARTBOARD_W = 1920;
export const ARTBOARD_H = 1080;

/** Inset kept free when clamping or searching for space, so nothing sits flush on the edge. */
export const SAFE_MARGIN = 40;

/** Step of the free-spot search grid (artboard units). */
export const PLACEMENT_GRID = 40;

/** Smallest box an element can be resized to. */
export const MIN_SIZE = 24;
