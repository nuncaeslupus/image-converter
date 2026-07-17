import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeImage, ImageDecodeError } from "../../src/lib/imageDecode";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures");

function loadFixture(name: string, type: string): File {
  const bytes = readFileSync(resolve(fixturesDir, name));
  return new File([bytes], name, { type });
}

describe("decodeImage", () => {
  it.each([
    ["sample.png", "image/png"],
    ["sample.jpg", "image/jpeg"],
    ["sample.webp", "image/webp"],
    ["sample.gif", "image/gif"],
    ["sample.bmp", "image/bmp"],
  ])("test_decodeImage_supportedFormats_returnsImageBitmap (%s)", async (fileName, mimeType) => {
    const file = loadFixture(fileName, mimeType);

    const bitmap = await decodeImage(file);

    expect(bitmap.width).toBeGreaterThan(0);
    expect(bitmap.height).toBeGreaterThan(0);
  });

  it("test_decodeImage_unsupportedFile_rejectsWithError", async () => {
    const file = loadFixture("sample.txt", "text/plain");

    const attempt = decodeImage(file);

    await expect(attempt).rejects.toBeInstanceOf(ImageDecodeError);
    await expect(attempt).rejects.toMatchObject({ code: "unsupported-format" });
  });
});
