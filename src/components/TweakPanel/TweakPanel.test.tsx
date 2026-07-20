import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/preact";
import { TweakPanel } from "./TweakPanel";
import { DEFAULT_TWEAK_VALUES } from "../../lib/tweakPipeline";

function renderPanel(props: Partial<Parameters<typeof TweakPanel>[0]>) {
  return render(<TweakPanel values={DEFAULT_TWEAK_VALUES} onChange={() => {}} {...props} />);
}

describe("TweakPanel colors", () => {
  it("test_tweakPanel_monochromePreview_hides2ColorsRow", () => {
    // A genuinely monochrome image: its 2-color preview collapses to one swatch,
    // so "2 colors" is identical to Black & white and must be dropped.
    renderPanel({ palettePreviews: { "2": ["#000000"] }, maxColors: 1 });

    expect(screen.queryByRole("radio", { name: "2 colors" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Black & white" })).toBeInTheDocument();
  });

  it("test_tweakPanel_twoColorPreview_keeps2ColorsRow", () => {
    // Two real colors in the 2-color preview → the row is meaningful, keep it.
    renderPanel({ palettePreviews: { "2": ["#aa0000", "#0000aa"] }, maxColors: 2 });

    expect(screen.getByRole("radio", { name: "2 colors" })).toBeInTheDocument();
  });

  it("test_tweakPanel_noPreviewYet_keeps2ColorsRow", () => {
    // Before the sample is computed, show the floor rather than flicker it away.
    renderPanel({ palettePreviews: undefined, maxColors: undefined });

    expect(screen.getByRole("radio", { name: "2 colors" })).toBeInTheDocument();
  });
});
