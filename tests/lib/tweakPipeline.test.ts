import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTweakPipeline, type TweakValues } from "../../src/lib/tweakPipeline";

const BASE: TweakValues = {
  paletteSize: 4,
  smoothness: 50,
  detail: 50,
  contrast: 0,
  background: "transparent",
};

describe("tweakPipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("test_tweakPipeline_paletteChange_triggersWorkerRetrace", () => {
    const runRetrace = vi.fn();
    const applyCheapEdit = vi.fn();
    const pipeline = createTweakPipeline(BASE, { runRetrace, applyCheapEdit });

    pipeline.update({ ...BASE, paletteSize: 8 });
    vi.runAllTimers();

    expect(runRetrace).toHaveBeenCalledTimes(1);
    expect(runRetrace).toHaveBeenCalledWith({
      paletteSize: 8,
      smoothness: 50,
      detail: 50,
      contrast: 0,
    });
    expect(applyCheapEdit).not.toHaveBeenCalled();
  });

  it("test_tweakPipeline_backgroundChange_skipsWorkerCall", () => {
    const runRetrace = vi.fn();
    const applyCheapEdit = vi.fn();
    const pipeline = createTweakPipeline(BASE, { runRetrace, applyCheapEdit });

    pipeline.update({ ...BASE, background: "solid" });
    vi.runAllTimers();

    expect(applyCheapEdit).toHaveBeenCalledTimes(1);
    expect(applyCheapEdit).toHaveBeenCalledWith({ ...BASE, background: "solid" });
    expect(runRetrace).not.toHaveBeenCalled();
  });

  it("test_tweakPipeline_rapidChanges_debouncedToLastValue", () => {
    const runRetrace = vi.fn();
    const applyCheapEdit = vi.fn();
    const pipeline = createTweakPipeline(BASE, { runRetrace, applyCheapEdit });

    pipeline.update({ ...BASE, smoothness: 60 });
    pipeline.update({ ...BASE, smoothness: 70 });
    pipeline.update({ ...BASE, smoothness: 80 });
    vi.runAllTimers();

    expect(runRetrace).toHaveBeenCalledTimes(1);
    expect(runRetrace).toHaveBeenCalledWith({
      paletteSize: 4,
      smoothness: 80,
      detail: 50,
      contrast: 0,
    });
    expect(applyCheapEdit).not.toHaveBeenCalled();
  });
});
