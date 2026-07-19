import { useState } from "preact/hooks";
import type { TweakValues } from "./tweakPipeline";

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
  /**
   * Replaces the working image directly — used ONLY by `EditStep`'s
   * `onChange` from the `Editor`. The Editor owns the lifecycle of every
   * bitmap it has ever produced (its own undo history + unmount cleanup —
   * see `components/Editor/Editor.tsx`), so this setter must NOT close the
   * outgoing bitmap: it is still referenced there. Every other call site
   * (Upload replace/remove, "Start over") goes through `replaceImage`
   * instead, which closes what it replaces.
   */
  setImage: (image: ImageBitmap | null) => void;
  /**
   * The pristine decode result for the current source image — set once per
   * upload and never mutated by crop/rotate edits, so the Editor's "Reset to
   * original" can always reach it even across a Back-to-Upload-and-return
   * round trip (a plain in-Editor undo-to-visit-start cannot, since that
   * history is local to one Edit-step mount). Owned solely by the wizard: it
   * is a bitmap distinct from `image` (see `replaceImage`) and is never
   * inserted into the Editor's undo history, so the Editor's unmount cleanup
   * (which closes every history entry except the one published as `image`)
   * can never touch it. Always set/cleared in lockstep with `image`.
   */
  originalImage: ImageBitmap | null;
  /**
   * Whether `image` is currently known to be pixel-identical to
   * `originalImage` — a flag maintained by the Editor (true right after a
   * fresh decode or a Reset, false after any applied crop/rotate), not a
   * pixel comparison. Drives the Editor's Reset-button disabled state so it
   * stays correct across a Back/Next round trip.
   */
  imageIsOriginal: boolean;
  /** Marks whether `image` is (still/again) identical to `originalImage` — called by the Editor on every applied edit, undo/redo, and reset. */
  setImageIsOriginal: (isOriginal: boolean) => void;
  /**
   * Replaces both the working image and the pristine original together,
   * closing whatever they previously pointed at first. Safe to call ONLY
   * from flows where the Editor is not mounted — Upload's decode/"Replace
   * image"/"Remove image", and App's "Start over" — because those are
   * exactly the flows where nothing else can be holding a reference to the
   * outgoing bitmaps (the Editor, while mounted, is the only other owner,
   * and it manages its own history's lifecycle independently; see
   * `setImage` above). Pass `(null, null)` to clear both.
   */
  replaceImage: (
    next: ImageBitmap | null,
    original: ImageBitmap | null,
    fileName: string | null,
  ) => void;
  /**
   * The uploaded source's original file name (e.g. "logo.png"), or `null` when
   * no image is loaded. Set alongside the image via `replaceImage` (the same
   * choke point that owns the image lifecycle), so it can never drift from the
   * current source. Export uses it to default the download name to
   * `<basename>.svg`.
   */
  fileName: string | null;
  /**
   * The current traced SVG markup (T6/T8), threaded to Export (T9) — see
   * status/plan.md "Data flow" step 8. `null` until Trace & Tweak produces a
   * first result.
   */
  svg: string | null;
  /** Replaces the current traced SVG — called on every trace result / cheap edit. */
  setSvg: (svg: string | null) => void;
  /**
   * The tweak panel's last-used values (T6), lifted here so they survive
   * Trace <-> Export navigation — `TraceStep` mounts/unmounts with the step,
   * so component-local state would reset to defaults on every revisit.
   * `null` until the user (or the initial trace) has produced a first value.
   */
  tweakValues: TweakValues | null;
  /** Replaces the current tweak values — called on every tweak-panel change. */
  setTweakValues: (values: TweakValues | null) => void;
}

/**
 * Drives the single-page wizard (see status/plan.md "UI flow (step wizard)").
 * Step transitions are in-memory state only — no router, no URL change.
 */
export function useWizard(initial: WizardStep = "upload"): Wizard {
  const [step, setStep] = useState<WizardStep>(initial);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [originalImage, setOriginalImage] = useState<ImageBitmap | null>(null);
  const [imageIsOriginal, setImageIsOriginal] = useState(true);
  const [svg, setSvg] = useState<string | null>(null);
  const [tweakValues, setTweakValues] = useState<TweakValues | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const stepIndex = WIZARD_STEPS.indexOf(step);

  // Closes whatever `image`/`originalImage` previously pointed at (unless
  // the incoming value happens to be the very same object — never true in
  // practice for real callers, but keeps this safe to call idempotently)
  // before publishing the replacement. See the `replaceImage` doc comment
  // on the `Wizard` interface for why this is only safe outside the Editor.
  function replaceImage(
    next: ImageBitmap | null,
    original: ImageBitmap | null,
    nextFileName: string | null,
  ) {
    // Close the outgoing bitmaps OUTSIDE the state updaters — updaters must
    // stay pure (double-invocation under strict/concurrent rendering would
    // close the replacement's predecessor twice). replaceImage only runs
    // from event handlers, so `image`/`originalImage` are current here.
    if (image && image !== next) image.close();
    if (originalImage && originalImage !== original) originalImage.close();
    setImage(next);
    setOriginalImage(original);
    setImageIsOriginal(true);
    setFileName(nextFileName);
  }

  return {
    step,
    stepIndex,
    goTo: setStep,
    next: () => setStep(WIZARD_STEPS[Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)]),
    back: () => setStep(WIZARD_STEPS[Math.max(stepIndex - 1, 0)]),
    image,
    setImage,
    originalImage,
    imageIsOriginal,
    setImageIsOriginal,
    replaceImage,
    fileName,
    svg,
    setSvg,
    tweakValues,
    setTweakValues,
  };
}
