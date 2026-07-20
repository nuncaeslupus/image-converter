import { describe, expect, it } from "vitest";
import { MESSAGES, LANGUAGES } from "../../src/lib/i18n";

describe("i18n", () => {
  it("every language has the same set of keys (no missing translations)", () => {
    const enKeys = Object.keys(MESSAGES.en).sort();
    for (const { value } of LANGUAGES) {
      expect(Object.keys(MESSAGES[value]).sort()).toEqual(enKeys);
    }
  });

  it("no message is an empty string", () => {
    for (const { value } of LANGUAGES) {
      for (const [key, v] of Object.entries(MESSAGES[value])) {
        if (typeof v === "string") expect(v, `${value}.${key}`).not.toBe("");
      }
    }
  });

  it("Spanish actually differs from English for translated labels", () => {
    expect(MESSAGES.es.colors).not.toBe(MESSAGES.en.colors);
    expect(MESSAGES.es.downloadSvg).not.toBe(MESSAGES.en.downloadSvg);
  });

  it("interpolation helpers include their argument", () => {
    expect(MESSAGES.en.colorsCount(3)).toContain("3");
    expect(MESSAGES.es.colorsCount(3)).toContain("3");
    expect(MESSAGES.en.decoding("a.png")).toContain("a.png");
    // Singular/plural handling for the Auto row count.
    expect(MESSAGES.en.autoColorsCount(1)).toBe("1 color");
    expect(MESSAGES.en.autoColorsCount(2)).toBe("2 colors");
  });
});
