import { describe, expect, it } from "vitest";
import {
  binarizeToBlack,
  medianCutPalette,
  quantizeRgba,
  rgbToHex,
  significantColorCount,
  type Rgb,
} from "../../src/lib/quantize";

/** Builds an RGBA buffer from a flat list of opaque colors (alpha 255). */
function rgba(colors: Rgb[], alphas?: number[]): Uint8Array {
  const buf = new Uint8Array(colors.length * 4);
  colors.forEach(([r, g, b], i) => {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = alphas ? alphas[i] : 255;
  });
  return buf;
}

function distinctColors(buf: Uint8Array): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i + 3] === 0) continue;
    set.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
  }
  return set;
}

describe("quantize", () => {
  // Four well-separated color clusters — median cut must resolve them cleanly.
  const RED: Rgb = [200, 10, 10];
  const GREEN: Rgb = [10, 200, 10];
  const BLUE: Rgb = [10, 10, 200];
  const YELLOW: Rgb = [200, 200, 10];
  const FIXTURE: Rgb[] = [RED, RED, GREEN, GREEN, BLUE, BLUE, YELLOW, YELLOW];

  it("medianCutPalette returns up to N colors for a rich-enough image", () => {
    expect(medianCutPalette(rgba(FIXTURE), 4)).toHaveLength(4);
    expect(medianCutPalette(rgba(FIXTURE), 2)).toHaveLength(2);
    expect(medianCutPalette(rgba(FIXTURE), 1)).toHaveLength(1);
  });

  it("medianCutPalette is deterministic", () => {
    const a = medianCutPalette(rgba(FIXTURE), 4);
    const b = medianCutPalette(rgba(FIXTURE), 4);
    expect(a).toEqual(b);
  });

  it("medianCutPalette never exceeds the image's own distinct colors", () => {
    // Only two distinct colors present — asking for 4 yields at most 2.
    const palette = medianCutPalette(rgba([RED, RED, BLUE, BLUE]), 4);
    expect(palette.length).toBeLessThanOrEqual(2);
  });

  it("medianCutPalette keeps a small distinct accent (area-independent)", () => {
    // A mostly-white image (100 px) with a single green accent pixel: classic
    // area-weighted median cut would merge the accent away, but ours must give
    // green its own slot at N=2. (Green here is far from white in color space.)
    const pixels: Rgb[] = Array.from({ length: 100 }, () => [250, 250, 250] as Rgb);
    pixels[50] = [20, 200, 20];
    const palette = medianCutPalette(rgba(pixels), 2);
    // One of the two palette entries should be clearly greenish, not white.
    const hasGreen = palette.some(([r, g, b]) => g > 120 && r < 120 && b < 120);
    expect(hasGreen).toBe(true);
  });

  it("quantizeRgba reduces to at most N distinct colors", () => {
    const out = quantizeRgba(rgba(FIXTURE), 2);
    expect(distinctColors(out).size).toBeLessThanOrEqual(2);
  });

  it("quantizeRgba preserves alpha and skips transparent pixels", () => {
    const alphas = [255, 0, 128, 255, 255, 255, 255, 255];
    const out = quantizeRgba(rgba(FIXTURE, alphas), 3);
    for (let i = 0; i < alphas.length; i++) {
      expect(out[i * 4 + 3]).toBe(alphas[i]);
    }
    // The fully-transparent pixel (index 1) keeps its original RGB.
    expect([out[4], out[5], out[6]]).toEqual(RED);
  });

  it("quantizeRgba does not mutate the input buffer", () => {
    const input = rgba(FIXTURE);
    const before = Array.from(input);
    quantizeRgba(input, 2);
    expect(Array.from(input)).toEqual(before);
  });

  it("significantColorCount counts the colors covering most of the image", () => {
    // A black-on-white icon: two colors already cover ~98%, so the tail of
    // antialiasing grays falls outside the coverage cutoff — reports 2, so the
    // Colors control doesn't offer a dozen redundant steps.
    const pixels: Rgb[] = [];
    for (let i = 0; i < 60; i++) pixels.push([250, 250, 250]); // white background
    for (let i = 0; i < 38; i++) pixels.push([10, 10, 10]); // black shape
    pixels.push([130, 130, 130], [90, 90, 90]); // ~2% edge grays — beyond the cutoff
    expect(significantColorCount(rgba(pixels))).toBe(2);
    // Four evenly-weighted clusters all fall within coverage → 4.
    expect(significantColorCount(rgba(FIXTURE))).toBe(4);
    // A stricter coverage pulls the thin tail back in.
    expect(significantColorCount(rgba(pixels), 0.999)).toBeGreaterThan(2);
  });

  it("rgbToHex formats lowercase 6-digit hex with zero padding", () => {
    expect(rgbToHex([0, 0, 0])).toBe("#000000");
    expect(rgbToHex([255, 255, 255])).toBe("#ffffff");
    expect(rgbToHex([16, 32, 48])).toBe("#102030");
  });
});

describe("binarizeToBlack", () => {
  const DARK: Rgb = [20, 20, 20];
  const LIGHT: Rgb = [240, 240, 240];

  it("paints the darker class black and drops the lighter class to transparent", () => {
    const buf = binarizeToBlack(rgba([DARK, DARK, LIGHT, LIGHT]));
    expect([buf[0], buf[1], buf[2], buf[3]]).toEqual([0, 0, 0, 255]);
    expect(buf[4 + 3]).toBe(255);
    expect(buf[8 + 3]).toBe(0); // light → transparent
    expect(buf[12 + 3]).toBe(0);
  });

  it("keeps faint mid-gray content against a dominant near-white background", () => {
    // Mirrors the real bug: a mostly-white image with light-gray "text". A
    // fixed 128 threshold would drop the gray; Otsu adapts and keeps it black.
    const pixels: Rgb[] = Array.from({ length: 100 }, () => [250, 250, 250] as Rgb);
    for (let i = 0; i < 15; i++) pixels[i] = [150, 150, 150];
    const buf = binarizeToBlack(rgba(pixels));
    // A gray "text" pixel is kept as opaque black.
    expect([buf[0], buf[1], buf[2], buf[3]]).toEqual([0, 0, 0, 255]);
    // A white background pixel is dropped.
    expect(buf[99 * 4 + 3]).toBe(0);
  });

  it("leaves already-transparent pixels transparent", () => {
    const buf = binarizeToBlack(rgba([DARK, LIGHT], [0, 255]));
    expect(buf[3]).toBe(0);
  });
});
