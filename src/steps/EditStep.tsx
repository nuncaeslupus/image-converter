import { useState } from "preact/hooks";
import type { Wizard } from "../lib/wizard";
import { Editor } from "../components/Editor/Editor";
import styles from "./EditStep.module.css";

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
        <p role="alert">No image to edit yet — go back and choose one first.</p>
      </section>
    );
  }

  const current = wizard.image ?? original;

  return (
    <section className={styles.root}>
      <Editor image={current} onChange={wizard.setImage} />
    </section>
  );
}
