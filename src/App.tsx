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
  GitHubIcon,
} from "./components/shellIcons";
import { Fragment, type FunctionComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useI18n } from "./lib/i18n";
import { LanguageSelect } from "./components/LanguageSelect";
import styles from "./App.module.css";

const STEP_META: {
  key: WizardStep;
  labelKey: "stepUpload" | "stepEdit" | "stepTrace" | "stepExport";
  icon: FunctionComponent<{ size?: number }>;
}[] = [
  // Same tray-upload glyph as the dropzone tile, for consistency.
  { key: "upload", labelKey: "stepUpload", icon: UploadTrayIcon },
  { key: "edit", labelKey: "stepEdit", icon: EditStepIcon },
  { key: "trace", labelKey: "stepTrace", icon: TraceStepIcon },
  { key: "export", labelKey: "stepExport", icon: ExportStepIcon },
];

export function App() {
  const wizard = useWizard();
  const { theme, toggle } = useTheme();
  const { m } = useI18n();
  const primaryLabels: string[] = [
    m.continueToEdit,
    m.continueToTrace,
    m.continueToExport,
    m.startOver,
  ];
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
    setAnnouncement(m.nowOnStep(m[STEP_META[current].labelKey]));
    // `m` intentionally omitted — announce on step change, not on language switch.
  }, [wizard.step, current]);

  function startOver() {
    // Closes the outgoing image + original — safe here because "Start over"
    // is only reachable from the last (Export) step, where the Editor is
    // unmounted (see `Wizard.replaceImage`'s doc comment).
    wizard.replaceImage(null, null);
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
            <div className={styles.brandText}>
              <h1 className={styles.wordmark}>Halftone</h1>
              <span className={styles.tagline}>{m.tagline}</span>
            </div>
          </div>
          <div className={styles.topActions}>
            <span className={styles.badge}>
              <LockIcon />
              {m.privateBadge}
            </span>
            <LanguageSelect />
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggle}
              title={m.toggleTheme}
              aria-label={theme === "dark" ? m.switchToLight : m.switchToDark}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        <div className={styles.card}>
          <nav className={styles.stepper} aria-label={m.wizardSteps}>
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
                      {m[meta.labelKey]}
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
                {m.back}
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
              {primaryLabels[current]}
            </button>
          </footer>
        </div>

        <footer className={styles.siteFooter}>
          <a
            className={styles.githubLink}
            href="https://github.com/nuncaeslupus/image-converter"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon size={16} />
            {m.viewSource}
          </a>
        </footer>
      </div>
    </div>
  );
}
