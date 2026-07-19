import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { bitmapFromPixels, IDENTITY_TRANSFORM } from "./imageEdit";
import { useWizard, type Wizard } from "./wizard";

async function makeBitmap(): Promise<ImageBitmap> {
  return bitmapFromPixels(2, 2, new Uint8ClampedArray(2 * 2 * 4).fill(128));
}

/**
 * Exposes the live `Wizard` to the test, driving all mutations through real
 * button clicks so state updates go through Preact's act()-wrapped handling.
 */
function Harness({ wizardBox }: { wizardBox: { current: Wizard | null } }) {
  const wizard = useWizard();
  wizardBox.current = wizard;
  return (
    <div>
      <p>image: {wizard.image ? "set" : "none"}</p>
      <p>rotation: {wizard.transform.rotation}</p>
      <button
        type="button"
        onClick={() => {
          void (async () => {
            wizard.replaceImage(await makeBitmap(), "fixture.png");
          })();
        }}
      >
        load
      </button>
      <button type="button" onClick={() => wizard.replaceImage(null, null)}>
        clear
      </button>
      <button type="button" onClick={() => wizard.setTransform({ rotation: 90, crop: null })}>
        rotate
      </button>
    </div>
  );
}

describe("wizard source-image lifecycle", () => {
  it("test_wizard_replaceImage_closesOutgoingSourceOnceAndResetsTransform", async () => {
    const user = userEvent.setup();
    const wizardBox: { current: Wizard | null } = { current: null };
    render(<Harness wizardBox={wizardBox} />);

    await user.click(screen.getByRole("button", { name: "load" }));
    await waitFor(() => expect(screen.getByText("image: set")).toBeInTheDocument());

    const firstImage = wizardBox.current!.image!;
    expect(wizardBox.current!.fileName).toBe("fixture.png");
    expect(wizardBox.current!.transform).toEqual(IDENTITY_TRANSFORM);
    const closeSpy = vi.spyOn(firstImage, "close");

    // A pending transform is discarded (reset to identity) when the source is
    // replaced — the transform belongs to the old image.
    await user.click(screen.getByRole("button", { name: "rotate" }));
    await waitFor(() => expect(screen.getByText("rotation: 90")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "load" }));
    await waitFor(() => expect(wizardBox.current!.image).not.toBe(firstImage));
    // The outgoing source is closed exactly once (no separate original to leak).
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(wizardBox.current!.transform).toEqual(IDENTITY_TRANSFORM);

    const secondImage = wizardBox.current!.image!;
    const closeSecondSpy = vi.spyOn(secondImage, "close");

    // Clearing ("Remove image" / "Start over") closes the current source once.
    await user.click(screen.getByRole("button", { name: "clear" }));
    await waitFor(() => expect(screen.getByText("image: none")).toBeInTheDocument());
    expect(closeSecondSpy).toHaveBeenCalledTimes(1);
  });
});
