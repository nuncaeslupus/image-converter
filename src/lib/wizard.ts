import { useState } from "preact/hooks";

export const WIZARD_STEPS = ["upload", "edit", "trace", "export"] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface Wizard {
  step: WizardStep;
  stepIndex: number;
  goTo: (step: WizardStep) => void;
  next: () => void;
  back: () => void;
  /**
   * The current working image, threaded across steps in-memory (see
   * status/plan.md "Data flow" step 2: Upload decodes it, Edit optionally
   * replaces it with a cropped/resized/rotated version, Trace consumes it).
   * `null` until Upload's decode succeeds.
   */
  image: ImageBitmap | null;
  /** Replaces the working image — e.g. after a successful decode (T4) or edit (T5). */
  setImage: (image: ImageBitmap | null) => void;
  /**
   * The current traced SVG markup (T6/T8), threaded to Export (T9) — see
   * status/plan.md "Data flow" step 8. `null` until Trace & Tweak produces a
   * first result.
   */
  svg: string | null;
  /** Replaces the current traced SVG — called on every trace result / cheap edit. */
  setSvg: (svg: string | null) => void;
}

/**
 * Drives the single-page wizard (see status/plan.md "UI flow (step wizard)").
 * Step transitions are in-memory state only — no router, no URL change.
 */
export function useWizard(initial: WizardStep = "upload"): Wizard {
  const [step, setStep] = useState<WizardStep>(initial);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const stepIndex = WIZARD_STEPS.indexOf(step);

  return {
    step,
    stepIndex,
    goTo: setStep,
    next: () => setStep(WIZARD_STEPS[Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)]),
    back: () => setStep(WIZARD_STEPS[Math.max(stepIndex - 1, 0)]),
    image,
    setImage,
    svg,
    setSvg,
  };
}
