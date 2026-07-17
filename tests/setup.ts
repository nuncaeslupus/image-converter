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
if (typeof globalThis.createImageBitmap !== "function") {
  globalThis.createImageBitmap = (async (blob: Blob): Promise<ImageBitmap> => {
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

    return {
      width: dimensions.width,
      height: dimensions.height,
      close() {
        /* no-op: test-environment shim holds no real GPU/bitmap resource */
      },
    } as ImageBitmap;
  }) as typeof createImageBitmap;
}
