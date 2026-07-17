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

    expect(screen.getByRole("heading", { name: "1. Upload" })).toBeInTheDocument();
  });

  it("test_app_uploadValidImage_advancesToEditStep", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText("Choose file", { selector: "input" });
    await user.upload(input, loadFixture("sample.png", "image/png"));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "2. Edit" })).toBeInTheDocument(),
    );
  });
});
