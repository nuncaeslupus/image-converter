import "@testing-library/jest-dom/vitest";
import { imageSize } from "image-size";

/**
 * jsdom has no image decoder at all — no canvas, no GPU, no native
 * `createImageBitmap` — so `src/lib/imageDecode.ts`'s call to the real
 * browser API has nothing to run against under Vitest. Production code
 * always calls the browser's native `createImageBitmap`; this shim exists
 * solely so `tests/lib/imageDecode.test.ts` can exercise genuine decode
 * behavior instead of a hand-mocked stub.
 *
 * Rather than fake a canned success/failure, this shim performs a real,
 * format-aware parse of the blob's bytes via `image-size` — the same
 * header-only-parsing technique that package uses in production to recover
 * true width/height for PNG/JPEG/WebP/GIF/BMP without a full pixel decode.
 * A corrupt or non-image payload genuinely fails to parse here, exactly as
 * a real decoder would reject it, rather than the test asserting on a value
 * that was mocked to already be correct.
 */
/**
 * jsdom does not implement the `ImageData` constructor (it ships no canvas
 * rendering backend at all). `src/lib/imageEdit.ts` builds its edited
 * bitmaps from a real `ImageData` instance, so provide the minimal
 * spec-shape constructor here rather than mocking `imageEdit.ts` itself.
 */
if (typeof globalThis.ImageData === "undefined") {
  class FakeImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace = "srgb";

    constructor(data: Uint8ClampedArray, width: number, height?: number) {
      this.data = data;
      this.width = width;
      this.height = height ?? data.length / 4 / width;
    }
  }
  globalThis.ImageData = FakeImageData as unknown as typeof ImageData;
}

/**
 * Real pixel content for `ImageBitmap`-like objects the shims below hand
 * out, keyed by object identity. Production `ImageBitmap`s never expose
 * their pixels directly (the browser only lets you read them back out via
 * a canvas `drawImage`/`getImageData` round trip) — this side table is how
 * the fake canvas 2D context below recovers "real" pixels for a bitmap it
 * is asked to draw, instead of returning blank/mocked data.
 */
const FAKE_BITMAP_PIXELS = new WeakMap<
  object,
  { width: number; height: number; data: Uint8ClampedArray }
>();

if (typeof globalThis.createImageBitmap !== "function") {
  globalThis.createImageBitmap = (async (source: Blob | ImageData): Promise<ImageBitmap> => {
    // `src/lib/imageEdit.ts` builds edited bitmaps from an `ImageData` it
    // computed itself — no format decode involved, so handle that source
    // distinctly from the `src/lib/imageDecode.ts` Blob-decode path below.
    if (!(source instanceof Blob)) {
      const imageData = source;
      const bitmap = {
        width: imageData.width,
        height: imageData.height,
        close() {
          /* no-op: test-environment shim holds no real GPU/bitmap resource */
        },
      } as ImageBitmap;
      FAKE_BITMAP_PIXELS.set(bitmap, {
        width: imageData.width,
        height: imageData.height,
        data: new Uint8ClampedArray(imageData.data),
      });
      return bitmap;
    }

    const blob = source;
    const bytes = new Uint8Array(await blob.arrayBuffer());

    let dimensions: { width?: number; height?: number };
    try {
      dimensions = imageSize(bytes);
    } catch (cause) {
      throw new DOMException(
        `Failed to decode image: ${(cause as Error).message}`,
        "InvalidStateError",
      );
    }

    if (!dimensions.width || !dimensions.height) {
      throw new DOMException("Failed to decode image: no dimensions found", "InvalidStateError");
    }

    const bitmap = {
      width: dimensions.width,
      height: dimensions.height,
      close() {
        /* no-op: test-environment shim holds no real GPU/bitmap resource */
      },
    } as ImageBitmap;
    // `image-size` only recovers header dimensions, not real pixels — but any
    // component that draws this bitmap into a canvas (e.g. UploadStep's
    // thumbnail preview) still needs *some* recorded pixel data for the fake
    // 2D context below to draw from, or its `drawImage()` throws. A flat
    // mid-gray fill is enough: nothing in these tests asserts real photo
    // pixel content, only that the draw completes and sizes correctly.
    FAKE_BITMAP_PIXELS.set(bitmap, {
      width: dimensions.width,
      height: dimensions.height,
      data: new Uint8ClampedArray(dimensions.width * dimensions.height * 4).fill(128),
    });
    return bitmap;
  }) as typeof createImageBitmap;
}

/**
 * jsdom implements the `<canvas>` element but ships no rendering backend, so
 * `canvas.getContext("2d")` returns `null` — nothing for
 * `src/lib/imageEdit.ts`'s bitmap→pixels extraction (`drawImage` +
 * `getImageData`) to run against. This shim implements just the operations
 * `imageEdit.ts` actually calls (a same-size, untransformed `drawImage` and a
 * matching `getImageData`) against the real pixel bytes recorded in
 * `FAKE_BITMAP_PIXELS` above, so the test exercises genuine pixel-copying
 * logic rather than a hand-mocked result. All resizing/cropping/rotating math
 * happens in plain TypeScript in `imageEdit.ts` itself — this shim only needs
 * to stand in for the one real browser capability jsdom lacks: reading a
 * bitmap's pixels back out.
 */
if (typeof HTMLCanvasElement !== "undefined") {
  const canvasPixels = new WeakMap<
    HTMLCanvasElement,
    { width: number; height: number; data: Uint8ClampedArray }
  >();

  class FakeCanvasRenderingContext2D {
    constructor(private readonly canvas: HTMLCanvasElement) {}

    drawImage(image: unknown, dx = 0, dy = 0): void {
      const source = FAKE_BITMAP_PIXELS.get(image as object);
      if (!source) {
        throw new Error(
          "test canvas shim: drawImage() source has no recorded pixel data (only " +
            "same-size, untransformed draws of shim-created bitmaps are supported)",
        );
      }
      const { width, height } = this.canvas;
      const state = canvasPixels.get(this.canvas) ?? {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      };
      for (let y = 0; y < source.height; y++) {
        const destY = y + dy;
        if (destY < 0 || destY >= height) continue;
        for (let x = 0; x < source.width; x++) {
          const destX = x + dx;
          if (destX < 0 || destX >= width) continue;
          const srcIdx = (y * source.width + x) * 4;
          const dstIdx = (destY * width + destX) * 4;
          state.data[dstIdx] = source.data[srcIdx];
          state.data[dstIdx + 1] = source.data[srcIdx + 1];
          state.data[dstIdx + 2] = source.data[srcIdx + 2];
          state.data[dstIdx + 3] = source.data[srcIdx + 3];
        }
      }
      canvasPixels.set(this.canvas, state);
    }

    getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
      const state = canvasPixels.get(this.canvas) ?? {
        width: this.canvas.width,
        height: this.canvas.height,
        data: new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4),
      };
      const out = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        const srcY = sy + y;
        if (srcY < 0 || srcY >= state.height) continue;
        for (let x = 0; x < sw; x++) {
          const srcX = sx + x;
          if (srcX < 0 || srcX >= state.width) continue;
          const srcIdx = (srcY * state.width + srcX) * 4;
          const dstIdx = (y * sw + x) * 4;
          out[dstIdx] = state.data[srcIdx];
          out[dstIdx + 1] = state.data[srcIdx + 1];
          out[dstIdx + 2] = state.data[srcIdx + 2];
          out[dstIdx + 3] = state.data[srcIdx + 3];
        }
      }
      return new ImageData(out, sw, sh);
    }
  }

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    ...args: unknown[]
  ) {
    if (contextId === "2d") {
      return new FakeCanvasRenderingContext2D(this) as unknown as ReturnType<
        typeof originalGetContext
      >;
    }
    return (
      originalGetContext as (
        this: HTMLCanvasElement,
        contextId: string,
        ...rest: unknown[]
      ) => ReturnType<typeof originalGetContext>
    ).call(this, contextId, ...args);
  } as typeof HTMLCanvasElement.prototype.getContext;
}
