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

    expect(screen.queryByTestId("traced-marker")).not.toBeInTheDocument();
    const canvas = screen.getByTestId("preview-original") as HTMLCanvasElement;
    const pixel = canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data;
    expect(Array.from(pixel)).toEqual([0, 0, 255, 255]);
  });

  it("test_previewCompare_released_showsTracedResult", async () => {
    const originalImage = await makeOriginalImage();
    render(<Preview title="Trace & Tweak" originalImage={originalImage} tracedSvg={TRACED_SVG} />);

    const button = screen.getByRole("button", { name: /hold to see original/i });
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);

    expect(screen.queryByTestId("preview-original")).not.toBeInTheDocument();
    expect(screen.getByTestId("traced-marker")).toBeInTheDocument();
  });
});
