import type { Wizard } from "../lib/wizard";
import { Export } from "../components/Export/Export";
import { svgDownloadName } from "../lib/svgExport";
import { Preview } from "../components/Preview/Preview";
import { useBakedImage } from "../lib/useBakedImage";
import { useI18n } from "../lib/i18n";
import styles from "./ExportStep.module.css";

/**
 * Wizard step 4 — download / copy / output-size / size estimate (T9).
 *
 * The exported file IS the SVG the user tweaked on the Trace step (`wizard.svg`)
 * — the trace and the export share one resolution, so there is no separate
 * full-resolution re-trace and therefore no preview↔export mismatch. The SVG is
 * resolution-independent (viewBox), so the Output-size controls just set the
 * `width`/`height` the file advertises; they default to the original (post-edit)
 * image dimensions, read from the baked bitmap.
 */
export function ExportStep({ wizard }: { wizard: Wizard }) {
  const { m } = useI18n();
  const previewSvg = wizard.svg;
  // Baked source (crop/rotate applied) — used only for its dimensions, which
  // seed the default output size so the export matches the image the user
  // actually uploaded/edited rather than the internal trace resolution.
  const image = useBakedImage(wizard.image, wizard.transform);

  if (!previewSvg) {
    return (
      <section>
        <p role="alert">{m.noTracedImage}</p>
      </section>
    );
  }

  return (
    <section className={styles.layout}>
      <div className={styles.previewCol}>
        <Preview title={m.svgReady} tracedSvg={previewSvg} />
      </div>
      <div className={styles.controls}>
        <Export
          svg={previewSvg}
          defaultFileName={svgDownloadName(wizard.fileName)}
          defaultWidth={image?.width}
          defaultHeight={image?.height}
        />
      </div>
    </section>
  );
}
