import { describe, expect, it, vi } from "vitest";
import {
  applyViewBoxOverride,
  countPaths,
  createSvgBlob,
  copySvgToClipboard,
  ensureViewBox,
  estimateSvg,
  svgDownloadName,
} from "../../src/lib/svgExport";

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

  it("test_countPaths_selfClosingAndOpenTags_countsBoth", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1H0z"/><path d="M1 1h1v1H1z"></path></svg>';

    expect(countPaths(svg)).toBe(2);
  });

  it("test_countPaths_noPaths_returnsZero", () => {
    expect(countPaths('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(0);
  });

  it("test_svgDownloadName_swapsExtensionOrFallsBack", () => {
    expect(svgDownloadName("logo.png")).toBe("logo.svg");
    expect(svgDownloadName("photo.final.jpeg")).toBe("photo.final.svg");
    expect(svgDownloadName("noext")).toBe("noext.svg");
    expect(svgDownloadName(null)).toBe("image.svg");
    expect(svgDownloadName("")).toBe("image.svg");
    expect(svgDownloadName(".hidden")).toBe("image.svg");
  });

  it("test_ensureViewBox_addsFromWidthHeightAndIsIdempotent", () => {
    const noVb =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="300" height="200"><path/></svg>';
    const withVb = ensureViewBox(noVb);
    expect(withVb).toContain('viewBox="0 0 300 200"');
    // Already-present viewBox and missing dimensions are both no-ops.
    expect(ensureViewBox(withVb)).toBe(withVb);
    expect(ensureViewBox("<svg><path/></svg>")).toBe("<svg><path/></svg>");
  });

  it("test_ensureViewBox_toleratesQuotesSpacesAndUnits", () => {
    // Single quotes, spaces around `=`, and a `px` unit must still be parsed.
    expect(ensureViewBox(`<svg width='300px' height = "200"><path/></svg>`)).toContain(
      'viewBox="0 0 300 200"',
    );
    // An existing single-quoted viewBox is respected — no duplicate added.
    const out = ensureViewBox(`<svg viewBox='0 0 5 5' width="5" height="5"><path/></svg>`);
    expect(out.match(/viewBox/g)?.length).toBe(1);
  });

  it("test_applyViewBoxOverride_singleQuotedSource_replacesNotDuplicates", () => {
    const out = applyViewBoxOverride(`<svg width='100' height='50'></svg>`, { width: 200 });
    expect(out).toContain('width="200"');
    expect(out.match(/width/g)?.length).toBe(1);
  });

  it("test_applyViewBoxOverride_valueWithDollarSign_insertsLiterally", () => {
    // A `$&`/`$1` in the value must not be treated as a String.replace pattern.
    const out = applyViewBoxOverride(SAMPLE_SVG, { viewBox: "0 0 $& 5" });
    expect(out).toContain('viewBox="0 0 $& 5"');
  });

  it("test_estimateSvg_selfClosingPath_agreesWithCountPaths", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1H0z"/></svg>';

    expect(estimateSvg(svg).pathCount).toBe(countPaths(svg));
    expect(estimateSvg(svg).pathCount).toBe(1);
  });
});
