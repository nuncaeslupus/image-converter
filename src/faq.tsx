/**
 * Entry for the static FAQ pages (faq/index.html, es/faq/index.html). The FAQ
 * content is baked into each shell (crawlable, per-language); this mounts the
 * SAME header + footer the tool uses (SiteHeader/SiteFooter) into the shell's
 * #faqTop / #faqBottom slots, so the top and bottom bars are identical to the
 * tool page. No wizard here.
 */
import { render } from "preact";
import { I18nProvider } from "./lib/i18n";
import { SiteHeader, SiteFooter } from "./components/Chrome";
import "./fonts";
import "./index.css";

const top = document.getElementById("faqTop");
const bottom = document.getElementById("faqBottom");
if (top)
  render(
    <I18nProvider>
      <SiteHeader />
    </I18nProvider>,
    top,
  );
if (bottom)
  render(
    <I18nProvider>
      <SiteFooter />
    </I18nProvider>,
    bottom,
  );
