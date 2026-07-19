import { describe, expect, it } from "vitest";
import { useState } from "preact/hooks";
import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { bitmapFromPixels, IDENTITY_TRANSFORM, type EditTransform } from "../lib/imageEdit";
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
 * A hand-built `Wizard` harness exposing `transform` as text, so tests can
 * assert the non-destructive transform the Editor writes (crop/rotate no
 * longer bake bitmaps — see the Editor rewrite).
 */
function Harness({ image }: { image: ImageBitmap }) {
  const [step, setStep] = useState<WizardStep>("edit");
  const [wizardImage, setWizardImage] = useState<ImageBitmap | null>(image);
  const [transform, setTransform] = useState<EditTransform>(IDENTITY_TRANSFORM);
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
    replaceImage: (next, nextFileName) => {
      if (wizardImage && wizardImage !== next) wizardImage.close();
      setWizardImage(next);
      setTransform(IDENTITY_TRANSFORM);
      setFileName(nextFileName);
    },
    fileName,
    transform,
    setTransform,
    svg,
    setSvg,
    tweakValues,
    setTweakValues,
  };

  return (
    <div>
      <p>current step: {wizard.step}</p>
      <p>rotation: {wizard.transform.rotation}</p>
      <p>cropped: {wizard.transform.crop ? "yes" : "no"}</p>
      <button type="button" onClick={() => wizard.goTo("trace")}>
        go-trace
      </button>
      <button type="button" onClick={() => wizard.goTo("edit")}>
        go-edit
      </button>
      {wizard.step === "edit" && <EditStep wizard={wizard} />}
    </div>
  );
}

describe("EditStep", () => {
  it("test_editStep_rendersCoreControls", async () => {
    render(<Harness image={await makeFixtureBitmap()} />);

    expect(screen.getByRole("button", { name: /90° left/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /90° right/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zoom out/i })).toBeInTheDocument();
  });

  it("test_editStep_rotate90_updatesTransformAndResetReturnsToIdentity", async () => {
    const user = userEvent.setup();
    render(<Harness image={await makeFixtureBitmap()} />);

    expect(screen.getByText("rotation: 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /90° right/i }));
    await waitFor(() => expect(screen.getByText("rotation: 90")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /reset/i })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect(screen.getByText("rotation: 0")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();
  });

  it("test_editStep_transformSurvivesEditTraceRoundTrip", async () => {
    // The spec's round-trip guarantee: the pending transform lives on the
    // wizard, so leaving Edit and returning preserves it (and never
    // double-applies, since nothing is baked here).
    const user = userEvent.setup();
    render(<Harness image={await makeFixtureBitmap()} />);

    await user.click(screen.getByRole("button", { name: /90° right/i }));
    await waitFor(() => expect(screen.getByText("rotation: 90")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "go-trace" }));
    await user.click(screen.getByRole("button", { name: "go-edit" }));

    // Re-mounted Editor seeds from the persisted transform.
    expect(screen.getByText("rotation: 90")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect(screen.getByText("rotation: 0")).toBeInTheDocument());
  });

  it("test_editStep_undoRevertsRotation", async () => {
    const user = userEvent.setup();
    render(<Harness image={await makeFixtureBitmap()} />);

    await user.click(screen.getByRole("button", { name: /90° right/i }));
    await waitFor(() => expect(screen.getByText("rotation: 90")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /undo/i }));
    await waitFor(() => expect(screen.getByText("rotation: 0")).toBeInTheDocument());
  });
});
