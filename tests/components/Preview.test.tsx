import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import { bitmapFromPixels } from "../../src/lib/imageEdit";
import { Preview } from "../../src/components/Preview/Preview";

// A marker element inside the traced SVG so the test can assert it's
// present/absent without depending on the SVG's real trace content.
const TRACED_SVG =
  '<svg data-testid="traced-marker"><rect width="1" height="1" fill="red" /></svg>';

// 1x1 solid blue original — visually distinguishable from the red traced fixture.
async function makeOriginalImage(): Promise<ImageBitmap> {
  return bitmapFromPixels(1, 1, new Uint8ClampedArray([0, 0, 255, 255]));
}

describe("Preview", () => {
  it("test_previewCompare_holdPressed_showsOriginal", async () => {
    const originalImage = await makeOriginalImage();
    render(<Preview title="Trace & Tweak" originalImage={originalImage} tracedSvg={TRACED_SVG} />);

    const button = screen.getByRole("button", { name: /hold to see original/i });
    fireEvent.pointerDown(button);

    // The traced SVG div stays mounted (T17: the compare canvas is drawn
    // once and just toggles visibility), so assert on visibility rather than
    // presence in the document.
    expect(screen.getByTestId("preview-traced")).not.toBeVisible();
    const canvas = screen.getByTestId("preview-original") as HTMLCanvasElement;
    expect(canvas).toBeVisible();
    const pixel = canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data;
    expect(Array.from(pixel)).toEqual([0, 0, 255, 255]);
  });

  it("test_previewCompare_released_showsTracedResult", async () => {
    const originalImage = await makeOriginalImage();
    render(<Preview title="Trace & Tweak" originalImage={originalImage} tracedSvg={TRACED_SVG} />);

    const button = screen.getByRole("button", { name: /hold to see original/i });
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);

    expect(screen.getByTestId("preview-original")).not.toBeVisible();
    expect(screen.getByTestId("traced-marker")).toBeVisible();
  });

  it("test_previewCompare_spaceKeyHeld_showsOriginalUntilKeyUp", async () => {
    const originalImage = await makeOriginalImage();
    render(<Preview title="Trace & Tweak" originalImage={originalImage} tracedSvg={TRACED_SVG} />);

    const button = screen.getByRole("button", { name: /hold to see original/i });
    fireEvent.keyDown(button, { key: " " });

    expect(screen.getByTestId("preview-original")).toBeVisible();

    fireEvent.keyUp(button, { key: " " });

    expect(screen.getByTestId("preview-original")).not.toBeVisible();
    expect(screen.getByTestId("traced-marker")).toBeVisible();
  });

  it("test_previewCompare_blurWhileHeld_revertsToTraced", async () => {
    const originalImage = await makeOriginalImage();
    render(<Preview title="Trace & Tweak" originalImage={originalImage} tracedSvg={TRACED_SVG} />);

    const button = screen.getByRole("button", { name: /hold to see original/i });
    fireEvent.keyDown(button, { key: "Enter" });
    expect(screen.getByTestId("preview-original")).toBeVisible();

    fireEvent.blur(button);

    expect(screen.getByTestId("preview-original")).not.toBeVisible();
  });
});
