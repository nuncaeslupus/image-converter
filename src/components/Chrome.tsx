/**
 * The site header (topbar) and footer — shared by the wizard app (App.tsx) and
 * the static FAQ pages (faq.tsx) so both have an IDENTICAL top and bottom bar.
 * They read the same i18n/theme/URL as the app, so the language picker, theme
 * toggle, keywords and FAQ link all behave the same everywhere.
 */
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { LanguageSelect } from "./LanguageSelect";
import { LogoMark, SunIcon, MoonIcon, GitHubIcon } from "./shellIcons";
import styles from "../App.module.css";

export function SiteHeader() {
  const { m, lang } = useI18n();
  const { theme, toggle } = useTheme();
  // The brand links to the tool in the current language — on the tool that's
  // "home", on the FAQ pages it's the way back.
  const toolHref = `${import.meta.env.BASE_URL}${lang === "es" ? "es/" : ""}`;
  return (
    <header className={styles.topbar}>
      <a className={styles.brand} href={toolHref}>
        <LogoMark size={52} />
        <div className={styles.brandText}>
          <div className={styles.wordmarkRow}>
            <h1 className={styles.wordmark}>Halftone</h1>
            <span className={styles.keywords}>{m.keywords}</span>
          </div>
          <span className={styles.tagline}>{m.tagline}</span>
        </div>
      </a>
      <div className={styles.topActions}>
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
  );
}

export function SiteFooter() {
  const { m, lang } = useI18n();
  return (
    <footer className={styles.siteFooter}>
      <a
        className={styles.githubLink}
        href={`${import.meta.env.BASE_URL}${lang === "es" ? "es/" : ""}faq/`}
      >
        {m.faq}
      </a>
      <a
        className={styles.githubLink}
        href="https://github.com/nuncaeslupus/halftone"
        target="_blank"
        rel="noopener noreferrer"
      >
        <GitHubIcon size={16} />
        {m.viewSource}
      </a>
    </footer>
  );
}
