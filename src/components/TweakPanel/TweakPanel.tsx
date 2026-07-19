import type { JSX } from "preact";
import type { TweakValues, BackgroundMode } from "../../lib/tweakPipeline";
import type { PaletteSize } from "../../lib/traceProtocol";
import { RADIOGROUP_KEYS, nextRovingIndex } from "../../lib/rovingFocus";
import styles from "./TweakPanel.module.css";

// Literal color counts, low-dense (posterization is most expressive at the low
// end) plus Auto. paletteSize is now an exact palette cap enforced by
// pre-quantizing the image before the trace (see lib/quantize.ts): 1 is a
// black-&-white silhouette (VTracer binary mode), 2..16 reduce to that many
// colors, Auto lets VTracer cluster on its own.
const PALETTE_OPTIONS: PaletteSize[] = [1, 2, 3, 4, 6, 8, 12, 16, "auto"];

function paletteLabel(preset: PaletteSize): string {
  if (preset === "auto") return "Auto";
  if (preset === 1) return "Black & white";
  return `${preset} colors`;
}

/**
 * "Removed" used to be a third option here, but it rendered byte-identically
 * to "Transparent" (see tweakPipeline.ts `applyBackground`) — a real
 * "detected background removed" mode needs pixel-level background detection
 * that doesn't exist yet, so the option was removed rather than ship a
 * control that silently does nothing.
 */
const BACKGROUND_OPTIONS: { value: BackgroundMode; label: string }[] = [
  { value: "transparent", label: "Transparent" },
  { value: "solid", label: "Solid" },
];

export interface TweakPanelProps {
  values: TweakValues;
  /** Called with the full next value set on any control change. */
  onChange: (values: TweakValues) => void;
  /** True while a retrace is in flight — disables retrace-affecting controls, never background. */
  busy?: boolean;
  /**
   * Real palette colors sampled from the current image, keyed by color count
   * (`"2"`..`"16"`), used to preview each Colors row's swatches. `undefined`
   * before the sample is computed (or under jsdom, which has no canvas).
   */
  palettePreviews?: Record<string, string[]>;
}

/**
 * Live tweak panel (T6): Colors (literal palette), smoothness, detail,
 * contrast, and background. Every control change is forwarded as a full
 * `TweakValues` snapshot — routing to a debounced worker retrace vs. an
 * immediate cheap edit is `tweakPipeline.ts`'s job, not this component's.
 */
export function TweakPanel({ values, onChange, busy = false, palettePreviews }: TweakPanelProps) {
  function set<K extends keyof TweakValues>(key: K, value: TweakValues[K]) {
    onChange({ ...values, [key]: value });
  }

  // WAI-ARIA radiogroup keyboard pattern: arrow keys move *and select* the
  // next/previous radio (wrapping), independent of which one currently has
  // focus — shared by the Colors list and the Background segmented control.
  function handleRadioKeyDown<T>(
    event: JSX.TargetedKeyboardEvent<HTMLDivElement>,
    options: readonly T[],
    currentIndex: number,
    select: (option: T) => void,
  ) {
    const nextIndex = nextRovingIndex(event.key, currentIndex, options.length, RADIOGROUP_KEYS);
    if (nextIndex === null) return;
    event.preventDefault();
    select(options[nextIndex]);
    event.currentTarget.querySelectorAll("button")[nextIndex]?.focus();
  }

  function swatchesFor(preset: PaletteSize): string[] {
    // B&W is a binary silhouette — one black shape, so a single black chip
    // represents it (not a median-cut mean color, which would be a muddy gray).
    if (preset === 1) return ["#000000"];
    if (preset === "auto") return [];
    return palettePreviews?.[String(preset)] ?? [];
  }

  const paletteIndex = PALETTE_OPTIONS.findIndex((p) => p === values.paletteSize);

  return (
    <div className={styles.panel}>
      <fieldset className={styles.group} disabled={busy}>
        <legend className={styles.label}>Colors</legend>
        <p className={styles.hint}>How many colors to keep. 1 is black &amp; white.</p>
        <div
          className={styles.paletteList}
          role="radiogroup"
          aria-label="Number of colors"
          onKeyDown={(event) =>
            handleRadioKeyDown(event, PALETTE_OPTIONS, paletteIndex, (option) =>
              set("paletteSize", option),
            )
          }
        >
          {PALETTE_OPTIONS.map((preset) => {
            const selected = values.paletteSize === preset;
            const swatches = swatchesFor(preset);
            return (
              <button
                key={String(preset)}
                type="button"
                className={styles.paletteRow}
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => set("paletteSize", preset)}
              >
                <span className={styles.paletteName}>{paletteLabel(preset)}</span>
                {preset === "auto" ? (
                  <span className={styles.paletteAuto}>VTracer picks</span>
                ) : (
                  <span className={styles.swatches} aria-hidden="true">
                    {swatches.map((color, i) => (
                      <span
                        key={`${color}-${i}`}
                        className={styles.swatch}
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={styles.group} disabled={busy}>
        <div className={styles.slider}>
          <div className={styles.sliderHead}>
            <span className={styles.sliderName}>Smoothness</span>
            <span className={`${styles.value} mono`}>{values.smoothness}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={values.smoothness}
            aria-label="Smoothness"
            onInput={(event) => set("smoothness", Number(event.currentTarget.value))}
          />
          <p className={styles.hint}>Rounds off jagged edges.</p>
        </div>
        <div className={styles.slider}>
          <div className={styles.sliderHead}>
            <span className={styles.sliderName}>Detail</span>
            <span className={`${styles.value} mono`}>{values.detail}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={values.detail}
            aria-label="Detail"
            onInput={(event) => set("detail", Number(event.currentTarget.value))}
          />
          <p className={styles.hint}>Keeps small features and fine lines.</p>
        </div>
        <div className={styles.slider}>
          <div className={styles.sliderHead}>
            <span className={styles.sliderName}>Contrast</span>
            <span className={`${styles.value} mono`}>{values.contrast}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={values.contrast}
            aria-label="Contrast"
            onInput={(event) => set("contrast", Number(event.currentTarget.value))}
          />
          <p className={styles.hint}>Splits colors into more or fewer layers.</p>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.label}>Background</legend>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-label="Background handling"
          onKeyDown={(event) =>
            handleRadioKeyDown(
              event,
              BACKGROUND_OPTIONS,
              BACKGROUND_OPTIONS.findIndex((o) => o.value === values.background),
              (option) => set("background", option.value),
            )
          }
        >
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.segment}
              role="radio"
              aria-checked={values.background === option.value}
              // Roving tabindex: only the checked radio is a Tab stop; arrow
              // keys (handled above) move between the others.
              tabIndex={values.background === option.value ? 0 : -1}
              onClick={() => set("background", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className={styles.hint}>Transparent, or solid white behind the shapes.</p>
      </fieldset>
    </div>
  );
}
