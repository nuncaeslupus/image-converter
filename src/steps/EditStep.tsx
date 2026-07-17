import type { Wizard } from "../lib/wizard";

/** Placeholder — real crop/resize/rotate lands in plan.md T5. */
export function EditStep({ wizard }: { wizard: Wizard }) {
  return (
    <section>
      <h2>2. Edit</h2>
      <p>Crop / resize / rotate (optional, skippable) — not yet implemented.</p>
      <button type="button" onClick={wizard.back}>
        Back
      </button>
      <button type="button" onClick={wizard.next}>
        Next
      </button>
    </section>
  );
}
