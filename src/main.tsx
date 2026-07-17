import { render } from "preact";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app root element not found");
}

render(<App />, root);
