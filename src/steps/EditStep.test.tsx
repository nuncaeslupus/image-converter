import { describe, expect, it } from "vitest";
import { useState } from "preact/hooks";
import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { bitmapFromPixels } from "../lib/imageEdit";
import { WIZARD_STEPS, type Wizard, type WizardStep } from "../lib/wizard";
import type { TweakValues } from "../lib/tweakPipeline";
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
function Harness({ image, originalImage }: { image: ImageBitmap; originalImage: ImageBitmap }) {
  const [step, setStep] = useState<WizardStep>("edit");
  const [wizardImage, setWizardImage] = useState<ImageBitmap | null>(image);
  const [wizardOriginalImage, setWizardOriginalImage] = useState<ImageBitmap | null>(originalImage);
  const [imageIsOriginal, setImageIsOriginal] = useState(true);
  const [svg, setSvg] = useState<string | null>(null);
  const [tweakValues, setTweakValues] = useState<TweakValues | null>(null);
  const [fileName, setFileName] = useState<string | null>("fixture.png");

  const wizard: Wizard = {
    step,
    stepIndex: WIZARD_STEPS.indexOf(step),
    goTo: setStep,
    next: () => setStep(WIZARD_STEPS[Math.min(WIZARD_STEPS.indexOf(step) + 1, 3)]),
    back: () => setStep(WIZARD_STEPS[Math.max(WIZARD_STEPS.indexOf(step) - 1, 0)]),
    image: wizardImage,
    setImage: setWizardImage,
    originalImage: wizardOriginalImage,
    imageIsOriginal,
    setImageIsOriginal,
    replaceImage: (next, original, nextFileName) => {
      if (wizardImage && wizardImage !== next) wizardImage.close();
      if (wizardOriginalImage && wizardOriginalImage !== original) wizardOriginalImage.close();
      setWizardImage(next);
      setWizardOriginalImage(original);
      setImageIsOriginal(true);
      setFileName(nextFileName);
    },
    fileName,
    svg,
    setSvg,
    tweakValues,
    setTweakValues,
  };

  return (
    <div>
      <p>current step: {wizard.step}</p>
      <p>image dims: {wizard.image ? `${wizard.image.width}x${wizard.image.height}` : "none"}</p>
      <button type="button" onClick={() => wizard.goTo("trace")}>
        go-trace
      </button>
      <button type="button" onClick={() => wizard.goTo("edit")}>
        go-edit
      </button>
      {/* Conditionally mounted, like the real App shell, so tests can exercise
          the Editor actually unmounting/remounting across a step round trip. */}
      {wizard.step === "edit" && <EditStep wizard={wizard} />}
    </div>
  );
}

describe("EditStep", () => {
  // Back/Next nav lives in the App shell footer now (not the step), so the
  // step-level nav tests moved to App.test.tsx.

  it("test_editStep_rendersToolbarWithStandardTools", async () => {
    const image = await makeFixtureBitmap();
    const originalImage = await makeFixtureBitmap();
    render(<Harness image={image} originalImage={originalImage} />);

    expect(screen.getByRole("toolbar", { name: "Image editing tools" })).toBeInTheDocument();
    // Exact name: crop handles are now `role="button"` too (see the a11y
    // fix in Editor.tsx), so a loose /crop/i match would also catch those
    // and the 4 corner handles, making this ambiguous.
    expect(screen.getByRole("button", { name: "Apply crop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate left/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate right/i })).toBeInTheDocument();
    // Resize was removed (SVG output is resized at Export); undo/redo/reset added.
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("test_editor_resetAfterLeavingAndReturning_restoresPristineOriginal", async () => {
    // Regression test for finding #3: Reset must reach the true pristine
    // decode (`wizard.originalImage`) even after the user leaves Edit and
    // comes back, not just this Editor mount's own starting image — the
    // Editor's local undo history cannot see across that round trip.
    const user = userEvent.setup();
    const image = await makeFixtureBitmap(); // 3x2
    const originalImage = await makeFixtureBitmap(); // a distinct 3x2 object — the pristine decode
    render(<Harness image={image} originalImage={originalImage} />);

    await user.click(screen.getByRole("button", { name: /rotate right/i }));
    await waitFor(() => expect(screen.getByText("image dims: 2x3")).toBeInTheDocument());

    // Leave Edit (the Editor unmounts) and come back.
    await user.click(screen.getByRole("button", { name: "go-trace" }));
    await user.click(screen.getByRole("button", { name: "go-edit" }));

    const resetButton = screen.getByRole("button", { name: /reset/i });
    expect(resetButton).not.toBeDisabled();
    await user.click(resetButton);

    await waitFor(() => expect(screen.getByText("image dims: 3x2")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();
  });

  it("test_editor_historyCap_undoLimitedToVisitStartPlusNineEdits", async () => {
    // Regression test for finding #2: the undo history must not grow
    // unbounded — only index 0 (visit start) plus the 9 most recent edits
    // are kept, so after 12 rotations only 9 undos should be possible.
    const user = userEvent.setup();
    const image = await makeFixtureBitmap();
    const originalImage = await makeFixtureBitmap();
    render(<Harness image={image} originalImage={originalImage} />);

    const rotateRightButton = screen.getByRole("button", { name: /rotate right/i });
    for (let i = 0; i < 12; i++) {
      await user.click(rotateRightButton);
      await waitFor(() => expect(rotateRightButton).not.toBeDisabled());
    }

    const undoButton = screen.getByRole("button", { name: /undo/i });
    for (let i = 0; i < 9; i++) {
      await user.click(undoButton);
    }
    await waitFor(() => expect(undoButton).toBeDisabled());
  });
});
