import { describe, expect, it } from "vitest";
import {
  bakeTransform,
  bitmapFromPixels,
  cropImage,
  IDENTITY_TRANSFORM,
  isIdentityTransform,
  readImagePixels,
  resizeImage,
  rotateImage,
} from "../../src/lib/imageEdit";

/**
 * A fixed, deterministic 4x2 fixture — every pixel gets a unique RGBA value
 * so any crop/rotate/resize can be checked against an exactly-computable
 * expected result, per this task's `edit_roundtrip_pixel_diff_max == 0` gate.
 * Layout (row, col) -> pixel index `row * 4 + col`:
 *   (0,0)=0  (0,1)=1  (0,2)=2  (0,3)=3
 *   (1,0)=4  (1,1)=5  (1,2)=6  (1,3)=7
 */
const FIXTURE_WIDTH = 4;
const FIXTURE_HEIGHT = 2;

function pixelColor(index: number): [number, number, number, number] {
  return [index * 10, 255 - index * 10, index % 2 === 0 ? 255 : 0, 255];
}

function makeFixtureData(): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(FIXTURE_WIDTH * FIXTURE_HEIGHT * 4);
  for (let index = 0; index < FIXTURE_WIDTH * FIXTURE_HEIGHT; index++) {
    const [r, g, b, a] = pixelColor(index);
    data[index * 4] = r;
    data[index * 4 + 1] = g;
    data[index * 4 + 2] = b;
    data[index * 4 + 3] = a;
  }
  return data;
}

function pixelAt(
  pixels: { width: number; data: Uint8ClampedArray },
  row: number,
  col: number,
): [number, number, number, number] {
  const idx = (row * pixels.width + col) * 4;
  return [pixels.data[idx], pixels.data[idx + 1], pixels.data[idx + 2], pixels.data[idx + 3]];
}

async function makeFixtureBitmap(): Promise<ImageBitmap> {
  return bitmapFromPixels(FIXTURE_WIDTH, FIXTURE_HEIGHT, makeFixtureData());
}

describe("imageEdit", () => {
  it("test_cropImage_boundingBox_matchesExpectedPixels", async () => {
    const bitmap = await makeFixtureBitmap();

    // Crop the right two columns of both rows: source indices 1,2 and 5,6.
    const cropped = await cropImage(bitmap, { x: 1, y: 0, width: 2, height: 2 });

    expect(cropped.width).toBe(2);
    expect(cropped.height).toBe(2);

    const pixels = await readImagePixels(cropped);
    expect(pixelAt(pixels, 0, 0)).toEqual(pixelColor(1));
    expect(pixelAt(pixels, 0, 1)).toEqual(pixelColor(2));
    expect(pixelAt(pixels, 1, 0)).toEqual(pixelColor(5));
    expect(pixelAt(pixels, 1, 1)).toEqual(pixelColor(6));
  });

  it("test_rotateImage_90Degrees_swapsDimensions", async () => {
    const bitmap = await makeFixtureBitmap();

    const rotated = await rotateImage(bitmap, 90);

    // A 4x2 source rotated 90 degrees clockwise becomes 2x4.
    expect(rotated.width).toBe(FIXTURE_HEIGHT);
    expect(rotated.height).toBe(FIXTURE_WIDTH);

    // Pixel content lands in the expected rotated position, not just the
    // dimensions: the source's top-left pixel (index 0) ends up in the
    // rotated image's top-right corner, and the source's bottom-left pixel
    // (index 4) ends up in the rotated image's top-left corner.
    const pixels = await readImagePixels(rotated);
    expect(pixelAt(pixels, 0, 0)).toEqual(pixelColor(4));
    expect(pixelAt(pixels, 0, 1)).toEqual(pixelColor(0));
    expect(pixelAt(pixels, 3, 0)).toEqual(pixelColor(7));
    expect(pixelAt(pixels, 3, 1)).toEqual(pixelColor(3));
  });

  it("test_resizeImage_targetDimensions_matchesOutputDimensions", async () => {
    const bitmap = await makeFixtureBitmap();

    const resizedUp = await resizeImage(bitmap, 9, 5);
    expect(resizedUp.width).toBe(9);
    expect(resizedUp.height).toBe(5);

    const resizedDown = await resizeImage(bitmap, 2, 1);
    expect(resizedDown.width).toBe(2);
    expect(resizedDown.height).toBe(1);
  });

  it("test_editRoundtrip_rotateFourTimes_pixelDiffIsZero", async () => {
    // Directly substantiates this task's gate, edit_roundtrip_pixel_diff_max
    // == 0: four 90-degree rotations return to the exact original pixels
    // (and original dimensions).
    const bitmap = await makeFixtureBitmap();
    const original = await readImagePixels(bitmap);

    let current = bitmap;
    for (let i = 0; i < 4; i++) {
      current = await rotateImage(current, 90);
    }

    expect(current.width).toBe(FIXTURE_WIDTH);
    expect(current.height).toBe(FIXTURE_HEIGHT);
    const roundTripped = await readImagePixels(current);
    expect(Array.from(roundTripped.data)).toEqual(Array.from(original.data));
  });
});

describe("bakeTransform", () => {
  it("test_bakeTransform_identity_returnsSameSizeCopy", async () => {
    const bitmap = await makeFixtureBitmap();
    const original = await readImagePixels(bitmap);

    const out = await bakeTransform(bitmap, IDENTITY_TRANSFORM);

    // A fresh bitmap (never the source itself), pixel-identical.
    expect(out).not.toBe(bitmap);
    expect(out.width).toBe(FIXTURE_WIDTH);
    expect(out.height).toBe(FIXTURE_HEIGHT);
    const baked = await readImagePixels(out);
    expect(Array.from(baked.data)).toEqual(Array.from(original.data));
  });

  it("test_bakeTransform_cropOnly_mapsNormalizedRectToPixels", async () => {
    const bitmap = await makeFixtureBitmap();

    // Right two columns of a 4x2 image: x 0.5..1.0, full height.
    const out = await bakeTransform(bitmap, {
      rotation: 0,
      crop: { x: 0.5, y: 0, w: 0.5, h: 1 },
    });

    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    const pixels = await readImagePixels(out);
    expect(pixelAt(pixels, 0, 0)).toEqual(pixelColor(2));
    expect(pixelAt(pixels, 0, 1)).toEqual(pixelColor(3));
    expect(pixelAt(pixels, 1, 0)).toEqual(pixelColor(6));
    expect(pixelAt(pixels, 1, 1)).toEqual(pixelColor(7));
  });

  it("test_bakeTransform_rightAngleRotation_isLosslessAndSwapsDims", async () => {
    const bitmap = await makeFixtureBitmap();

    const out = await bakeTransform(bitmap, { rotation: 90, crop: null });

    // Lossless (rotateImage path): 4x2 -> 2x4, same pixel content as a direct rotate.
    expect(out.width).toBe(FIXTURE_HEIGHT);
    expect(out.height).toBe(FIXTURE_WIDTH);
    const pixels = await readImagePixels(out);
    expect(pixelAt(pixels, 0, 0)).toEqual(pixelColor(4));
    expect(pixelAt(pixels, 0, 1)).toEqual(pixelColor(0));
  });

  it("test_bakeTransform_rotationThenCrop_composes", async () => {
    const bitmap = await makeFixtureBitmap();

    // Rotate 90 -> 2x4, then keep the top half -> 2x2.
    const out = await bakeTransform(bitmap, {
      rotation: 90,
      crop: { x: 0, y: 0, w: 1, h: 0.5 },
    });

    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
  });

  it("test_isIdentityTransform", () => {
    expect(isIdentityTransform({ rotation: 0, crop: null })).toBe(true);
    expect(isIdentityTransform({ rotation: 360, crop: null })).toBe(true);
    expect(isIdentityTransform({ rotation: -720, crop: null })).toBe(true);
    expect(isIdentityTransform({ rotation: 90, crop: null })).toBe(false);
    expect(isIdentityTransform({ rotation: 0, crop: { x: 0, y: 0, w: 1, h: 1 } })).toBe(false);
  });
});
