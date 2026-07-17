/**
 * Basic image editing — crop, resize, rotate (T5 — see status/plan.md "Data
 * flow" step 2 and "UI flow (step wizard)" step 2).
 *
 * Each operation takes the working `ImageBitmap` (produced by T4's
 * `decodeImage`, see `src/lib/imageDecode.ts`) and returns a new
 * `ImageBitmap`. The original bitmap is never mutated — callers that no
 * longer need it should `close()` it themselves once the replacement lands.
 *
 * Implementation strategy: an `ImageBitmap` exposes no direct pixel access —
 * the only way to read its pixels back out is a canvas `drawImage` +
 * `getImageData` round trip. So each op does exactly ONE canvas draw (a
 * same-size, untransformed `drawImage`, i.e. never a crop/scale in canvas
 * itself) to extract the source pixels, then performs the actual
 * crop/rotate/resize as plain, deterministic array math over the raw RGBA
 * bytes, and finally rebuilds an `ImageBitmap` straight from an `ImageData`
 * (no second canvas draw needed — `createImageBitmap` accepts `ImageData`
 * directly). Keeping the crop/rotate/resize math out of canvas's own
 * transform/scaling pipeline is deliberate: canvas scaling is not specified
 * to be pixel-exact, and the resample used here (nearest-neighbor) is, which
 * is what makes an edit round trip (e.g. rotating back, or cropping and
 * re-expanding to the original bounds) reproduce the source exactly — see
 * this task's gate, `edit_roundtrip_pixel_diff_max == 0`.
 */

/** A crop region in source-bitmap pixel coordinates. */
export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A `Uint8ClampedArray` explicitly backed by a real `ArrayBuffer` (as
 * opposed to the wider `ArrayBufferLike`, which also covers
 * `SharedArrayBuffer`) — the shape the DOM `ImageData` constructor requires.
 * Every array here is always freshly allocated via `new Uint8ClampedArray(n)`
 * (never backed by shared memory), so this is a type-level fact, asserted
 * once at each array's construction site rather than re-derived by callers.
 */
type Pixels = Uint8ClampedArray<ArrayBuffer>;

/** Raw RGBA pixel buffer, row-major, 4 bytes/pixel — the shape of `ImageData.data`. */
interface PixelBuffer {
  width: number;
  height: number;
  data: Pixels;
}

function getContext2D(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("imageEdit: 2D canvas context is unavailable in this environment");
  }
  return ctx;
}

/** Reads an `ImageBitmap`'s pixels via a single same-size, untransformed canvas draw. */
function bitmapToPixels(bitmap: ImageBitmap): PixelBuffer {
  const ctx = getContext2D(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return {
    width: imageData.width,
    height: imageData.height,
    data: new Uint8ClampedArray(imageData.data) as Pixels,
  };
}

/** Rebuilds an `ImageBitmap` directly from a pixel buffer — no canvas draw needed. */
async function pixelsToBitmap(pixels: PixelBuffer): Promise<ImageBitmap> {
  const imageData = new ImageData(pixels.data, pixels.width, pixels.height);
  return createImageBitmap(imageData);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

/** Copies the sub-rectangle `box` (clamped to the source bounds) out of `pixels`. */
function cropPixels(pixels: PixelBuffer, box: CropBox): PixelBuffer {
  const x = clampInt(box.x, 0, pixels.width - 1);
  const y = clampInt(box.y, 0, pixels.height - 1);
  const width = clampInt(box.width, 1, pixels.width - x);
  const height = clampInt(box.height, 1, pixels.height - y);

  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const srcStart = ((y + row) * pixels.width + x) * 4;
    const destStart = row * width * 4;
    data.set(pixels.data.subarray(srcStart, srcStart + width * 4), destStart);
  }
  return { width, height, data };
}

/** Rotates `pixels` 90 degrees clockwise once; width and height swap. */
function rotatePixels90Clockwise(pixels: PixelBuffer): PixelBuffer {
  const { width: srcWidth, height: srcHeight, data: srcData } = pixels;
  const width = srcHeight;
  const height = srcWidth;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      // result[row][col] = source[srcHeight - 1 - col][row]
      const srcRow = srcHeight - 1 - col;
      const srcCol = row;
      const srcIdx = (srcRow * srcWidth + srcCol) * 4;
      const destIdx = (row * width + col) * 4;
      data[destIdx] = srcData[srcIdx];
      data[destIdx + 1] = srcData[srcIdx + 1];
      data[destIdx + 2] = srcData[srcIdx + 2];
      data[destIdx + 3] = srcData[srcIdx + 3];
    }
  }
  return { width, height, data };
}

/** Nearest-neighbor resample to exactly `targetWidth` x `targetHeight` — deterministic, no blending. */
function resizePixelsNearestNeighbor(
  pixels: PixelBuffer,
  targetWidth: number,
  targetHeight: number,
): PixelBuffer {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round(targetHeight));
  const data = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row++) {
    const srcRow = Math.min(pixels.height - 1, Math.floor((row * pixels.height) / height));
    for (let col = 0; col < width; col++) {
      const srcCol = Math.min(pixels.width - 1, Math.floor((col * pixels.width) / width));
      const srcIdx = (srcRow * pixels.width + srcCol) * 4;
      const destIdx = (row * width + col) * 4;
      data[destIdx] = pixels.data[srcIdx];
      data[destIdx + 1] = pixels.data[srcIdx + 1];
      data[destIdx + 2] = pixels.data[srcIdx + 2];
      data[destIdx + 3] = pixels.data[srcIdx + 3];
    }
  }
  return { width, height, data };
}

/** Crops `bitmap` to `box` (clamped to the source bounds), returning a new `ImageBitmap`. */
export async function cropImage(bitmap: ImageBitmap, box: CropBox): Promise<ImageBitmap> {
  const pixels = bitmapToPixels(bitmap);
  return pixelsToBitmap(cropPixels(pixels, box));
}

/**
 * Rotates `bitmap` by `degrees`, normalized to the nearest 90-degree
 * increment (any multiple of 90, including negative values, is accepted).
 * Rotating by 90 or 270 degrees swaps width and height; 0 and 180 do not.
 */
export async function rotateImage(bitmap: ImageBitmap, degrees: number): Promise<ImageBitmap> {
  const quarterTurns = (((Math.round(degrees / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  let pixels = bitmapToPixels(bitmap);
  for (let i = 0; i < quarterTurns; i++) {
    pixels = rotatePixels90Clockwise(pixels);
  }
  return pixelsToBitmap(pixels);
}

/** Resizes `bitmap` to exactly `targetWidth` x `targetHeight` (nearest-neighbor). */
export async function resizeImage(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageBitmap> {
  const pixels = bitmapToPixels(bitmap);
  return pixelsToBitmap(resizePixelsNearestNeighbor(pixels, targetWidth, targetHeight));
}

/**
 * Builds a synthetic `ImageBitmap` from an explicit RGBA pixel grid — used
 * by tests to construct fixtures with known, deterministic pixel content
 * (see `tests/lib/imageEdit.test.ts`), and available to production code that
 * wants to hand-construct a bitmap without going through file decode.
 */
export async function bitmapFromPixels(
  width: number,
  height: number,
  data: Pixels,
): Promise<ImageBitmap> {
  return pixelsToBitmap({ width, height, data });
}

/**
 * Reads a bitmap's raw RGBA pixels back out (the same single canvas-draw
 * extraction the ops above use internally). Exposed for tests asserting on
 * exact pixel content, and for the Editor preview to hand-render a bitmap.
 */
export async function readImagePixels(
  bitmap: ImageBitmap,
): Promise<{ width: number; height: number; data: Pixels }> {
  return bitmapToPixels(bitmap);
}
