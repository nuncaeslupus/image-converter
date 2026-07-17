import type { Wizard } from "../lib/wizard";

/** Placeholder — download/copy/viewBox override/estimate land in plan.md T9. */
export function ExportStep({ wizard }: { wizard: Wizard }) {
  return (
    <section>
      <h2>4. Export</h2>
      <p>Download / copy markup / viewBox override / size estimate — not yet implemented.</p>
      <button type="button" onClick={wizard.back}>
        Back
      </button>
    </section>
  );
}
