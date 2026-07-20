import type { JSX } from "preact";
import type { TweakValues, BackgroundMode } from "../../lib/tweakPipeline";
import type { PaletteSize } from "../../lib/traceProtocol";
import { RADIOGROUP_KEYS, nextRovingIndex } from "../../lib/rovingFocus";
import { ResetIcon } from "../Editor/icons";
import { useI18n, type Messages } from "../../lib/i18n";
import styles from "./TweakPanel.module.css";

// Auto first — it's the default, so it belongs at the top rather than hidden at
// the bottom of the scroll — then the literal color counts, low-dense
// (posterization is most expressive at the low end). paletteSize is an exact
// palette cap enforced by reducing the image before the trace (see
// lib/quantize.ts): 1 is a black-&-white silhouette (Otsu binarize), 2..16
// reduce to that many colors, Auto lets VTracer cluster on its own.
export const PALETTE_OPTIONS: PaletteSize[] = ["auto", 1, 2, 3, 4, 6, 8, 12, 16];

function paletteLabel(preset: PaletteSize, m: Messages): string {
  if (preset === "auto") return m.auto;
  if (preset === 1) return m.blackWhite;
  return m.colorsCount(preset);
}

// The three retrace sliders, with their reset-to defaults (the midpoints).
// `key` doubles as the value field and the Messages label key; `hintKey` is the
// Messages hint key.
const SLIDERS = [
  { key: "smoothness", hintKey: "smoothnessHint", min: 0, max: 100, def: 50 },
  { key: "detail", hintKey: "detailHint", min: 0, max: 100, def: 50 },
  { key: "contrast", hintKey: "contrastHint", min: -100, max: 100, def: 0 },
] as const;

/**
 * "Removed" used to be a third option here, but it rendered byte-identically
 * to "Transparent" (see tweakPipeline.ts `applyBackground`) — a real
 * "detected background removed" mode needs pixel-level background detection
 * that doesn't exist yet, so the option was removed rather than ship a
 * control that silently does nothing.
 */
const BACKGROUND_OPTIONS: { value: BackgroundMode; labelKey: "transparent" | "solid" }[] = [
  { value: "transparent", labelKey: "transparent" },
  { value: "solid", labelKey: "solid" },
];

export interface TweakPanelProps {
  values: TweakValues;
  /** Called with the full next value set on any control change. */
  onChange: (values: TweakValues) => void;
  /**
   * Real palette colors sampled from the current image, keyed by color count
   * (`"2"`..`"16"`), used to preview each Colors row's swatches. `undefined`
   * before the sample is computed (or under jsdom, which has no canvas).
   */
  palettePreviews?: Record<string, string[]>;
  /**
   * How many colors the current Auto trace actually produced, shown on the
   * Auto row. Only known while Auto is the active selection (counted from the
   * result); `undefined` otherwise, in which case the row shows nothing.
   */
  autoColorCount?: number;
  /**
   * How many colors the image *meaningfully* has. Colored palette counts above
   * this are hidden — a pure black-on-white icon (2) only offers "Black & white"
   * and "2 colors", not a dozen steps that would all collapse to the same
   * result. `undefined` before it's computed → all counts shown.
   */
  maxColors?: number;
}

/**
 * Live tweak panel (T6): Colors (literal palette), smoothness, detail,
 * contrast, and background. Every control change is forwarded as a full
 * `TweakValues` snapshot — routing to a debounced worker retrace vs. an
 * immediate cheap edit is `tweakPipeline.ts`'s job, not this component's.
 */
export function TweakPanel({
  values,
  onChange,
  palettePreviews,
  autoColorCount,
  maxColors,
}: TweakPanelProps) {
  const { m } = useI18n();
  function set<K extends keyof TweakValues>(key: K, value: TweakValues[K]) {
    onChange({ ...values, [key]: value });
  }

  // Only offer color counts the image can actually fill. B&W (1), 2 colors, and
  // Auto always apply, so they're the floor; 3+ appear only when the image has
  // that many meaningful colors. Until the sample is in, show every option.
  const paletteOptions = PALETTE_OPTIONS.filter(
    (preset) =>
      preset === 1 ||
      preset === 2 ||
      preset === "auto" ||
      maxColors === undefined ||
      (typeof preset === "number" && preset <= maxColors),
  );

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

  const paletteIndex = paletteOptions.findIndex((p) => p === values.paletteSize);

  return (
    <div className={styles.panel}>
      <fieldset className={`${styles.group} ${styles.colorsGroup}`}>
        <legend className={styles.label}>{m.colors}</legend>
        <p className={styles.hint}>{m.colorsHint}</p>
        <div
          className={styles.paletteList}
          role="radiogroup"
          aria-label={m.numberOfColors}
          onKeyDown={(event) =>
            handleRadioKeyDown(event, paletteOptions, paletteIndex, (option) =>
              set("paletteSize", option),
            )
          }
        >
          {paletteOptions.map((preset) => {
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
                <span className={styles.paletteName}>{paletteLabel(preset, m)}</span>
                {preset === "auto" ? (
                  <span className={styles.paletteAuto}>
                    {autoColorCount ? m.autoColorsCount(autoColorCount) : ""}
                  </span>
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

      <fieldset className={styles.group}>
        <legend className={styles.srOnly}>{m.traceAdjustments}</legend>
        {SLIDERS.map(({ key, hintKey, min, max, def }) => {
          const label = m[key];
          return (
            <div key={key} className={styles.slider}>
              <div className={styles.sliderHead}>
                <span className={styles.sliderName}>{label}</span>
                <span className={styles.sliderMeta}>
                  <span className={`${styles.value} mono`}>{values[key]}</span>
                  {values[key] !== def && (
                    <button
                      type="button"
                      className={styles.sliderReset}
                      onClick={() => set(key, def)}
                      aria-label={m.resetControl(label)}
                      title={m.resetControl(label)}
                    >
                      <ResetIcon />
                    </button>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                value={values[key]}
                aria-label={label}
                onInput={(event) => set(key, Number(event.currentTarget.value))}
              />
              <p className={styles.hint}>{m[hintKey]}</p>
            </div>
          );
        })}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.label}>{m.background}</legend>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-label={m.backgroundHandling}
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
              {m[option.labelKey]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
