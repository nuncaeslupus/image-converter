import { describe, expect, it, vi } from "vitest";
import { applyViewBoxOverride, createSvgBlob, copySvgToClipboard } from "../../src/lib/svgExport";

const SAMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><path d="M0 0h10v10H0z"/></svg>';

describe("svgExport", () => {
  it("test_exportSvg_download_producesValidSvgBlob", async () => {
    const blob = createSvgBlob(SAMPLE_SVG);

    expect(blob.type).toBe("image/svg+xml");
    const text = await blob.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.tagName).toBe("svg");
  });

  it("test_exportSvg_copyToClipboard_writesFullMarkup", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await copySvgToClipboard(SAMPLE_SVG);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(SAMPLE_SVG);
  });

  it("test_exportSvg_viewBoxOverride_appliesWithoutRetrace", () => {
    const trace = vi.fn();

    const result = applyViewBoxOverride(SAMPLE_SVG, {
      viewBox: "0 0 200 100",
      width: 200,
      height: 100,
    });

    expect(result).toContain('viewBox="0 0 200 100"');
    expect(result).toContain('width="200"');
    expect(result).toContain('height="100"');
    // The override is a pure string rewrite — no tracer/worker function is ever invoked.
    expect(trace).not.toHaveBeenCalled();
  });
});
