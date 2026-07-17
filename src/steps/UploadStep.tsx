import type { Wizard } from "../lib/wizard";

/** Placeholder — real upload/decode lands in plan.md T4. */
export function UploadStep({ wizard }: { wizard: Wizard }) {
  return (
    <section>
      <h2>1. Upload</h2>
      <p>File picker / drag-and-drop image decode — not yet implemented.</p>
      <button type="button" onClick={wizard.next}>
        Next
      </button>
    </section>
  );
}
