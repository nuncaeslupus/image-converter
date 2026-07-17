import { describe, expect, it } from "vitest";
import { useState } from "preact/hooks";
import { render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { bitmapFromPixels } from "../lib/imageEdit";
import { WIZARD_STEPS, type Wizard, type WizardStep } from "../lib/wizard";
import { EditStep } from "./EditStep";

async function makeFixtureBitmap(): Promise<ImageBitmap> {
  const width = 3;
  const height = 2;
  const data = new Uint8ClampedArray(width * height * 4).fill(128);
  return bitmapFromPixels(width, height, data);
}

/**
 * A hand-built `Wizard` harness (rather than `useWizard`) so the fixture
 * bitmap can be seeded synchronously on first render — `EditStep` captures
 * its "original" image on mount, so the image must already be present
 * before `EditStep` ever renders.
 */
function Harness({ image }: { image: ImageBitmap }) {
  const [step, setStep] = useState<WizardStep>("edit");
  const [wizardImage, setWizardImage] = useState<ImageBitmap | null>(image);

  const wizard: Wizard = {
    step,
    stepIndex: WIZARD_STEPS.indexOf(step),
    goTo: setStep,
    next: () => setStep(WIZARD_STEPS[Math.min(WIZARD_STEPS.indexOf(step) + 1, 3)]),
    back: () => setStep(WIZARD_STEPS[Math.max(WIZARD_STEPS.indexOf(step) - 1, 0)]),
    image: wizardImage,
    setImage: setWizardImage,
  };

  return (
    <div>
      <p>current step: {wizard.step}</p>
      <p>image dims: {wizard.image ? `${wizard.image.width}x${wizard.image.height}` : "none"}</p>
      <EditStep wizard={wizard} />
    </div>
  );
}

describe("EditStep", () => {
  it("test_editStep_backButton_returnsToUpload", async () => {
    const user = userEvent.setup();
    const image = await makeFixtureBitmap();
    render(<Harness image={image} />);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("current step: upload")).toBeInTheDocument();
  });

  it("test_editStep_nextWithNoEdits_advancesWithOriginalImagePassedThroughUnchanged", async () => {
    const user = userEvent.setup();
    const image = await makeFixtureBitmap();
    render(<Harness image={image} />);

    expect(screen.getByText("image dims: 3x2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("current step: trace")).toBeInTheDocument();
    // Skippable by design: no tool was touched, so the original bitmap's
    // dimensions carry through unchanged.
    expect(screen.getByText("image dims: 3x2")).toBeInTheDocument();
  });

  it("test_editStep_rendersToolbarWithStandardTools", async () => {
    const image = await makeFixtureBitmap();
    render(<Harness image={image} />);

    expect(screen.getByRole("toolbar", { name: "Image editing tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate left/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate right/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resize/i })).toBeInTheDocument();
  });
});
