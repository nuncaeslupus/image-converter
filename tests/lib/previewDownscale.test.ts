import { describe, expect, it } from "vitest";
import { needsFullResRetrace, PREVIEW_MAX_DIMENSION } from "../../src/lib/previewDownscale";

describe("needsFullResRetrace", () => {
  it("test_needsFullResRetrace_belowCap_returnsFalse", () => {
    expect(needsFullResRetrace(400, 300)).toBe(false);
  });

  it("test_needsFullResRetrace_exactlyAtCap_returnsFalse", () => {
    expect(needsFullResRetrace(PREVIEW_MAX_DIMENSION, 100)).toBe(false);
  });

  it("test_needsFullResRetrace_aboveCap_returnsTrue", () => {
    expect(needsFullResRetrace(4000, 3000)).toBe(true);
  });

  it("test_needsFullResRetrace_tallImageAboveCap_checksLongEdge", () => {
    expect(needsFullResRetrace(100, PREVIEW_MAX_DIMENSION + 1)).toBe(true);
  });

  it("test_needsFullResRetrace_customMaxDimension_respectsOverride", () => {
    expect(needsFullResRetrace(200, 200, 100)).toBe(true);
    expect(needsFullResRetrace(100, 100, 100)).toBe(false);
  });
});
