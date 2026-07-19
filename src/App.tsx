import { WIZARD_STEPS, useWizard, type WizardStep } from "./lib/wizard";
import { useTheme } from "./lib/theme";
import { UploadStep } from "./steps/UploadStep";
import { EditStep } from "./steps/EditStep";
import { TraceStep } from "./steps/TraceStep";
import { ExportStep } from "./steps/ExportStep";
import {
  LogoMark,
  LockIcon,
  SunIcon,
  MoonIcon,
  CheckIcon,
  UploadTrayIcon,
  EditStepIcon,
  TraceStepIcon,
  ExportStepIcon,
} from "./components/shellIcons";
import { Fragment, type FunctionComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./App.module.css";

const STEP_META: {
  key: WizardStep;
  label: string;
  icon: FunctionComponent<{ size?: number }>;
}[] = [
  // Same tray-upload glyph as the dropzone tile, for consistency.
  { key: "upload", label: "Upload", icon: UploadTrayIcon },
  { key: "edit", label: "Edit", icon: EditStepIcon },
  { key: "trace", label: "Trace", icon: TraceStepIcon },
  { key: "export", label: "Export", icon: ExportStepIcon },
];

const PRIMARY_LABELS = [
  "Continue to Edit",
  "Continue to Trace",
  "Continue to Export",
  "Start over",
];

export function App() {
  const wizard = useWizard();
  const { theme, toggle } = useTheme();
  const current = wizard.stepIndex;
  const mainRef = useRef<HTMLElement>(null);
  const mountedRef = useRef(false);
  const [announcement, setAnnouncement] = useState("");

  // A file dropped anywhere outside the Upload step's dropzone otherwise
  // navigates the tab to the raw file (destroying all in-memory work — the
  // image, edits, and traced SVG are never persisted anywhere). Mounted for
  // the app's whole lifetime so it's never possible to "miss" re-arming it
  // on a step change.
  useEffect(() => {
    function preventDefault(event: DragEvent) {
      event.preventDefault();
    }
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  // Move focus to the step region and announce the change on every step
  // transition (but not on first mount — there's nothing to announce yet).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    mainRef.current?.focus();
    setAnnouncement(`Step ${current + 1} of ${WIZARD_STEPS.length}: ${STEP_META[current].label}`);
  }, [wizard.step]);

  function startOver() {
    wizard.setImage(null);
    wizard.setSvg(null);
    wizard.goTo("upload");
  }

  // The footer primary is gated on each step's precondition so it can't skip
  // ahead of the real data: no image yet on Upload, no traced SVG yet on Trace.
  const primaryDisabled = (current === 0 && !wizard.image) || (current === 2 && !wizard.svg);

  // Stepper nodes are clickable but gated: Edit/Trace need an uploaded image,
  // Export needs a traced SVG. Upload is always reachable.
  function stepReachable(i: number): boolean {
    if (i === 0) return true;
    if (i === 3) return !!wizard.svg;
    return !!wizard.image;
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <LogoMark size={52} />
            <h1 className={styles.wordmark}>Halftone</h1>
          </div>
          <div className={styles.topActions}>
            <span className={styles.badge}>
              <LockIcon />
              Private — files never leave your device
            </span>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggle}
              title="Toggle theme"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        <div className={styles.card}>
          <nav className={styles.stepper} aria-label="Wizard steps">
            {STEP_META.map((meta, i) => {
              const state = i < current ? "done" : i === current ? "current" : "upcoming";
              const Icon = meta.icon;
              const reachable = stepReachable(i);
              return (
                <Fragment key={meta.key}>
                  {i > 0 && (
                    <div
                      className={`${styles.connector} ${
                        current > i - 1 ? styles.connectorOn : styles.connectorOff
                      }`}
                    />
                  )}
                  <button
                    type="button"
                    className={styles.step}
                    onClick={() => wizard.goTo(meta.key)}
                    disabled={!reachable}
                    aria-current={state === "current" ? "step" : undefined}
                  >
                    <span
                      className={`${styles.dot} ${
                        state === "done"
                          ? styles.dotDone
                          : state === "current"
                            ? styles.dotCurrent
                            : styles.dotUpcoming
                      }`}
                    >
                      {state === "done" ? <CheckIcon /> : <Icon size={20} />}
                    </span>
                    <span
                      className={`${styles.stepLabel} ${
                        state === "done"
                          ? styles.labelDone
                          : state === "current"
                            ? styles.labelCurrent
                            : styles.labelUpcoming
                      }`}
                    >
                      {meta.label}
                    </span>
                  </button>
                </Fragment>
              );
            })}
          </nav>

          <main className={styles.body} tabIndex={-1} ref={mainRef}>
            {wizard.step === "upload" && <UploadStep wizard={wizard} />}
            {wizard.step === "edit" && <EditStep wizard={wizard} />}
            {wizard.step === "trace" && <TraceStep wizard={wizard} />}
            {wizard.step === "export" && <ExportStep wizard={wizard} />}
          </main>

          <div className={styles.visuallyHidden} aria-live="polite">
            {announcement}
          </div>

          <footer className={styles.footer}>
            {current > 0 ? (
              <button type="button" className={styles.btnBack} onClick={wizard.back}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={current === WIZARD_STEPS.length - 1 ? startOver : wizard.next}
              disabled={primaryDisabled}
            >
              {PRIMARY_LABELS[current]}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
