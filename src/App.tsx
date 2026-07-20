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
  RestartIcon,
} from "./components/shellIcons";
import { Fragment, type FunctionComponent, type JSX } from "preact";
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
  const { m, lang } = useI18n();
  // One per non-final step; the final step renders its own de-emphasized
  // "Start over" button instead of an accent primary (see the footer).
  const primaryLabels: string[] = [m.continueToEdit, m.continueToTrace, m.continueToExport];
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

  // Warn before a reload / tab close once there's in-memory work to lose — the
  // image, edits, and traced SVG live only in memory (see the drop guard
  // above), so an accidental reload silently drops everything. Armed only while
  // there's something to lose; browsers show their own generic prompt text.
  useEffect(() => {
    if (!wizard.image && !wizard.svg) return;
    function warnOnUnload(event: BeforeUnloadEvent) {
      // Legacy signal first, then the modern one last so it has the final say.
      event.returnValue = "";
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnOnUnload);
    return () => window.removeEventListener("beforeunload", warnOnUnload);
  }, [wizard.image, wizard.svg]);

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

  // Two-step "Start over" so a stray double-click can't wipe the work: the
  // first click asks to confirm, the second (Yes) actually resets.
  const [confirmingStartOver, setConfirmingStartOver] = useState(false);
  const startOverBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmWasOpen = useRef(false);

  // Focus trap + Esc for the confirmation modal. Keydown only fires while focus
  // is inside the dialog (it's focused on open), so Escape is always reachable;
  // Tab/Shift+Tab wrap between the first and last focusable so focus can't
  // escape to the page behind the modal.
  function handleDialogKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setConfirmingStartOver(false);
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>("button");
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    // Clicking the dialog body focuses the container itself (tabIndex -1);
    // treat that like "before first" so Shift+Tab wraps in instead of leaking
    // focus to the page behind.
    const atStart =
      document.activeElement === first || document.activeElement === dialogRef.current;
    if (event.shiftKey && atStart) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Reset the pending confirmation whenever the step changes, so leaving Export
  // mid-confirm and returning doesn't strand the app in the confirming state.
  useEffect(() => {
    setConfirmingStartOver(false);
  }, [current]);

  // Keep focus sensible when the button swaps to/from the confirmation row
  // (otherwise it drops to <body>): focus the safe Cancel action on open, and
  // return focus to the Start-over button on cancel.
  useEffect(() => {
    if (confirmingStartOver) {
      confirmWasOpen.current = true;
      cancelBtnRef.current?.focus();
    } else if (confirmWasOpen.current) {
      confirmWasOpen.current = false;
      startOverBtnRef.current?.focus();
    }
  }, [confirmingStartOver]);

  function startOver() {
    // Closes the outgoing image + original — safe here because "Start over"
    // is only reachable from the last (Export) step, where the Editor is
    // unmounted (see `Wizard.replaceImage`'s doc comment).
    setConfirmingStartOver(false);
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
            {current === WIZARD_STEPS.length - 1 ? (
              // Last step: the forward action is Download (in the Export panel),
              // so "Start over" is deliberately de-emphasized here — a muted,
              // icon-led button, not the accent primary — so it doesn't read as
              // the next logical step and get clicked instead of Download. It
              // opens a confirmation modal (rendered below) rather than acting
              // immediately, so a stray click can't wipe the work.
              <button
                ref={startOverBtnRef}
                type="button"
                className={styles.btnStartOver}
                onClick={() => setConfirmingStartOver(true)}
              >
                <RestartIcon size={15} />
                {m.startOver}
              </button>
            ) : (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={wizard.next}
                disabled={primaryDisabled}
              >
                {primaryLabels[current]}
              </button>
            )}
          </footer>
        </div>

        <footer className={styles.siteFooter}>
          <a
            className={styles.githubLink}
            href={`${import.meta.env.BASE_URL}${lang === "es" ? "es/" : ""}faq/`}
          >
            {m.faq}
          </a>
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

      {confirmingStartOver && (
        // Backdrop click cancels; the modal stops propagation so clicks inside
        // don't. Esc + focus trap live in handleDialogKeyDown.
        <div className={styles.modalBackdrop} onClick={() => setConfirmingStartOver(false)}>
          <div
            ref={dialogRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="startOverTitle"
            aria-describedby="startOverDesc"
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="startOverTitle" className={styles.modalTitle}>
              {m.startOver}
            </h2>
            <p id="startOverDesc" className={styles.modalText}>
              {m.startOverConfirm}
            </p>
            <div className={styles.modalActions}>
              <button
                ref={cancelBtnRef}
                type="button"
                className={styles.btnBack}
                onClick={() => setConfirmingStartOver(false)}
              >
                {m.cancel}
              </button>
              <button type="button" className={styles.btnStartOver} onClick={startOver}>
                <RestartIcon size={15} />
                {m.startOver}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
