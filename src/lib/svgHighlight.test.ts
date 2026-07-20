import { describe, expect, it } from "vitest";
import { highlightSvg } from "./svgHighlight";

const rebuild = (src: string) =>
  highlightSvg(src)
    .map((t) => t.text)
    .join("");

describe("highlightSvg", () => {
  it("round-trips arbitrary markup byte-for-byte", () => {
    const samples = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0L4 4" fill="#000"/></svg>',
      "<g>\n  <rect x='1' y='2' />\n</g>",
      '<!-- a comment --><circle r="2"/>text tail',
      "",
    ];
    for (const s of samples) expect(rebuild(s)).toBe(s);
  });

  it("classifies tag names, attributes, and values", () => {
    const t = highlightSvg('<path d="M0 0"/>');
    expect(t.find((x) => x.cls === "tag")?.text).toBe("path");
    expect(t.find((x) => x.cls === "attr")?.text).toBe("d");
    expect(t.find((x) => x.cls === "val")?.text).toBe('"M0 0"');
  });

  it("keeps comments as a single token", () => {
    expect(highlightSvg("<!-- hi -->").filter((x) => x.cls === "com")).toHaveLength(1);
  });

  it("skips tokenization for extremely large markup (one plain token)", () => {
    const big = `<svg>${"a".repeat(100_001)}</svg>`;
    const tokens = highlightSvg(big);
    expect(tokens).toEqual([{ cls: "txt", text: big }]);
  });
});
