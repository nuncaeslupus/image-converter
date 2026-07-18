import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { save, load, STORAGE_KEY } from "../../src/lib/settingsStore";
import { DEFAULT_TWEAK_VALUES, type TweakValues } from "../../src/lib/tweakPipeline";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("test_settingsStore_saveThenLoad_returnsSameConfig", () => {
    const config: TweakValues = {
      paletteSize: 8,
      smoothness: 20,
      detail: 70,
      contrast: -10,
      background: "solid",
    };

    save(config);

    expect(load()).toEqual(config);
  });

  it("test_settingsStore_corruptedOrMissingStorage_fallsBackToDefaults", () => {
    expect(load()).toEqual(DEFAULT_TWEAK_VALUES);

    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(load()).toEqual(DEFAULT_TWEAK_VALUES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ paletteSize: 4 }));
    expect(load()).toEqual(DEFAULT_TWEAK_VALUES);
  });
});
