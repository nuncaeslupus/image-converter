import { describe, expect, it } from "vitest";
import { decodeImage, ImageDecodeError, MAX_IMAGE_BYTES } from "./imageDecode";

describe("decodeImage size cap", () => {
  it("rejects a file over the 25 MB cap before attempting decode", async () => {
    // A sparse Blob whose reported size exceeds the cap — decodeImage must
    // reject on size alone, without ever calling createImageBitmap.
    const oversized = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/png" });

    const error = await decodeImage(oversized).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageDecodeError);
    expect((error as ImageDecodeError).code).toBe("file-too-large");
  });
});
