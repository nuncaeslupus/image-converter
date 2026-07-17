import { useState } from "preact/hooks";
import type { Wizard } from "../lib/wizard";
import { Editor } from "../components/Editor/Editor";

/**
 * Wizard step 2 — optional crop/resize/rotate editing (T5).
 *
 * Operates on the `ImageBitmap` decoded by Upload (T4, `wizard.image`).
 * This step is skippable by design (status/plan.md "UI flow (step wizard)"
 * step 2): the original bitmap already lives in `wizard.image` when this
 * step mounts, so clicking Next without touching any tool passes it through
 * to Trace & Tweak completely unchanged.
 */
export function EditStep({ wizard }: { wizard: Wizard }) {
  // Captured once on mount so "Reset" always has the untouched decode
  // result to restore, even after `wizard.image` has been replaced by an
  // applied edit.
  const [original] = useState(() => wizard.image);

  if (!original) {
    return (
      <section>
        <h2>2. Edit</h2>
        <p role="alert">No image to edit yet — go back and choose one first.</p>
        <button type="button" onClick={wizard.back}>
          Back
        </button>
      </section>
    );
  }

  const current = wizard.image ?? original;

  return (
    <section>
      <h2>2. Edit</h2>
      <p>Crop, resize, or rotate the image. This step is optional — Next continues as-is.</p>

      <Editor image={current} originalImage={original} onChange={wizard.setImage} />

      <div>
        <button type="button" onClick={wizard.back}>
          Back
        </button>
        <button type="button" onClick={wizard.next}>
          Next
        </button>
      </div>
    </section>
  );
}
