import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { bitmapFromPixels } from "./imageEdit";
import { useWizard, type Wizard } from "./wizard";

async function makeBitmap(): Promise<ImageBitmap> {
  return bitmapFromPixels(2, 2, new Uint8ClampedArray(2 * 2 * 4).fill(128));
}

/**
 * Exposes the live `Wizard` object to the test via a mutable ref-like
 * object, updated on every render, while driving all mutations through real
 * button clicks (so state updates go through Preact's normal act()-wrapped
 * event handling rather than being poked from outside a render).
 */
function Harness({ wizardBox }: { wizardBox: { current: Wizard | null } }) {
  const wizard = useWizard();
  wizardBox.current = wizard;
  return (
    <div>
      <p>image: {wizard.image ? "set" : "none"}</p>
      <p>original: {wizard.originalImage ? "set" : "none"}</p>
      <button
        type="button"
        onClick={() => {
          void (async () => {
            const bitmap = await makeBitmap();
            const original = await makeBitmap();
            wizard.replaceImage(bitmap, original);
          })();
        }}
      >
        load
      </button>
      <button type="button" onClick={() => wizard.replaceImage(null, null)}>
        clear
      </button>
    </div>
  );
}

describe("wizard image/originalImage lifecycle", () => {
  it("test_wizard_replaceImage_closesOutgoingImageAndOriginalExactlyOnce", async () => {
    const user = userEvent.setup();
    const wizardBox: { current: Wizard | null } = { current: null };
    render(<Harness wizardBox={wizardBox} />);

    await user.click(screen.getByRole("button", { name: "load" }));
    await waitFor(() => expect(screen.getByText("image: set")).toBeInTheDocument());

    const firstImage = wizardBox.current!.image!;
    const firstOriginal = wizardBox.current!.originalImage!;
    expect(firstImage).not.toBe(firstOriginal); // distinct owners, not aliased
    expect(wizardBox.current!.imageIsOriginal).toBe(true);
    const closeImageSpy = vi.spyOn(firstImage, "close");
    const closeOriginalSpy = vi.spyOn(firstOriginal, "close");

    // Replacing with a second image/original pair (the "Replace image" flow)
    // must close both outgoing bitmaps exactly once — see finding #1.
    await user.click(screen.getByRole("button", { name: "load" }));
    await waitFor(() => expect(wizardBox.current!.image).not.toBe(firstImage));

    expect(closeImageSpy).toHaveBeenCalledTimes(1);
    expect(closeOriginalSpy).toHaveBeenCalledTimes(1);
    expect(wizardBox.current!.imageIsOriginal).toBe(true);

    const secondImage = wizardBox.current!.image!;
    const secondOriginal = wizardBox.current!.originalImage!;
    const closeSecondImageSpy = vi.spyOn(secondImage, "close");
    const closeSecondOriginalSpy = vi.spyOn(secondOriginal, "close");

    // Clearing (the "Remove image" / "Start over" flow) must also close
    // whatever was current exactly once.
    await user.click(screen.getByRole("button", { name: "clear" }));
    await waitFor(() => expect(screen.getByText("image: none")).toBeInTheDocument());

    expect(closeSecondImageSpy).toHaveBeenCalledTimes(1);
    expect(closeSecondOriginalSpy).toHaveBeenCalledTimes(1);
  });
});
