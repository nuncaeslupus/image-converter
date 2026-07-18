import type { JSX } from "preact";
import { useState } from "preact/hooks";
import {
  applyViewBoxOverride,
  copySvgToClipboard,
  downloadSvg,
  estimateSvg,
} from "../../lib/svgExport";
import styles from "./Export.module.css";

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export interface ExportProps {
  /** The current traced SVG markup (status/plan.md "Data flow" step 8). */
  svg: string;
}

/**
 * Export controls (T9): download `.svg`, copy raw markup, override output
 * size/viewBox, and a size/path-count estimate. The override is a pure string
 * rewrite (`applyViewBoxOverride`) applied on every render — never a tracer
 * call — so it's reflected instantly in the estimate, download, and copy.
 */
export function Export({ svg }: ExportProps) {
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [viewBox, setViewBox] = useState("");
  const [copied, setCopied] = useState(false);

  const effectiveSvg = applyViewBoxOverride(svg, {
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
    viewBox: viewBox || undefined,
  });
  const estimate = estimateSvg(effectiveSvg);

  async function handleCopy() {
    await copySvgToClipboard(effectiveSvg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleNumberInput(setter: (value: string) => void) {
    return (event: JSX.TargetedEvent<HTMLInputElement>) => setter(event.currentTarget.value);
  }

  return (
    <div className={styles.export}>
      <fieldset className={styles.group}>
        <legend>Size / viewBox override</legend>
        <label className={styles.field}>
          Width
          <input
            type="number"
            min={1}
            placeholder="auto"
            value={width}
            onInput={handleNumberInput(setWidth)}
          />
        </label>
        <label className={styles.field}>
          Height
          <input
            type="number"
            min={1}
            placeholder="auto"
            value={height}
            onInput={handleNumberInput(setHeight)}
          />
        </label>
        <label className={styles.field}>
          viewBox
          <input
            type="text"
            placeholder="e.g. 0 0 100 100"
            value={viewBox}
            onInput={(event) => setViewBox(event.currentTarget.value)}
          />
        </label>
      </fieldset>

      <p className={styles.estimate} role="status">
        Estimated size: {formatBytes(estimate.bytes)} · {estimate.pathCount} path
        {estimate.pathCount === 1 ? "" : "s"}
      </p>

      <div className={styles.actions}>
        <button type="button" onClick={() => downloadSvg(effectiveSvg)}>
          Download .svg
        </button>
        <button type="button" onClick={() => void handleCopy()}>
          {copied ? "Copied!" : "Copy markup"}
        </button>
      </div>
    </div>
  );
}
