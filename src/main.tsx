import { render } from "preact";
import { App } from "./App";
import { I18nProvider } from "./lib/i18n";
import "./index.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app root element not found");
}

render(
  <I18nProvider>
    <App />
  </I18nProvider>,
  root,
);
