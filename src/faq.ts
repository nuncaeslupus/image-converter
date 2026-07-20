/**
 * Entry for the static FAQ pages (faq/index.html, es/faq/index.html). The FAQ
 * content is baked into each shell (crawlable, per-language); this only loads
 * the shared fonts + styles and applies the saved theme so the page matches the
 * tool. No app / no wizard here.
 */
import "./fonts";
import "./index.css";
import { applyStoredTheme } from "./lib/theme";

applyStoredTheme();
