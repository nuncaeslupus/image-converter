import { describe, expect, it } from "vitest";
import { medianCutPalette, quantizeRgba, rgbToHex, type Rgb } from "../../src/lib/quantize";

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

  it("medianCutPalette returns exactly N colors for a rich-enough image", () => {
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
    // Only two unique colors present — asking for 4 can yield at most 2.
    const palette = medianCutPalette(rgba([RED, RED, BLUE, BLUE]), 4);
    expect(palette.length).toBeLessThanOrEqual(2);
  });

  it("quantizeRgba reduces to at most N distinct colors", () => {
    const out = quantizeRgba(rgba(FIXTURE), 2);
    expect(distinctColors(out).size).toBeLessThanOrEqual(2);
  });

  it("quantizeRgba preserves alpha and skips transparent pixels", () => {
    const alphas = [255, 0, 128, 255, 255, 255, 255, 255];
    const out = quantizeRgba(rgba(FIXTURE, alphas), 3);
    // Alpha channel untouched.
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

  it("rgbToHex formats lowercase 6-digit hex with zero padding", () => {
    expect(rgbToHex([0, 0, 0])).toBe("#000000");
    expect(rgbToHex([255, 255, 255])).toBe("#ffffff");
    expect(rgbToHex([16, 32, 48])).toBe("#102030");
  });
});
