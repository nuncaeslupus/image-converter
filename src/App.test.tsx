import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");

function loadFixture(name: string, type: string): File {
  const bytes = readFileSync(resolve(fixturesDir, name));
  return new File([bytes], name, { type });
}

describe("App wizard shell", () => {
  it("test_app_initialRender_showsUploadStep", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Add an image to vectorize" })).toBeInTheDocument();
  });

  it("test_app_uploadValidImage_advancesToEditStep", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText("Choose file", { selector: "input" });
    await user.upload(input, loadFixture("sample.png", "image/png"));

    // Edit step is identified by its rotate controls (the shell owns the
    // per-step headings/nav now, so there's no "2. Edit" heading).
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /90° right/i })).toBeInTheDocument(),
    );
  });

  // The beforeunload guard (App.tsx) arms via a useEffect once wizard.image /
  // svg exist. It's intentionally left untested here: this harness can't
  // observe an effect that arms after an async, UI-driven state update
  // (userEvent doesn't flush update-effects; fireEvent flushes only
  // synchronous ones — the upload decode is async), and the guard itself is a
  // one-line `if (!image && !svg) return` branch.
});
