import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { useWizard } from "../lib/wizard";
import { UploadStep } from "./UploadStep";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../tests/fixtures");

function loadFixture(name: string, type: string): File {
  const bytes = readFileSync(resolve(fixturesDir, name));
  return new File([bytes], name, { type });
}

function Harness() {
  const wizard = useWizard();
  return (
    <div>
      <p>current step: {wizard.step}</p>
      <UploadStep wizard={wizard} />
    </div>
  );
}

describe("UploadStep", () => {
  it("test_uploadStep_validImage_advancesWizardToEdit", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText("Choose file", { selector: "input" });
    await user.upload(input, loadFixture("sample.png", "image/png"));

    await waitFor(() => expect(screen.getByText("current step: edit")).toBeInTheDocument());
  });

  it("test_uploadStep_unsupportedFile_showsErrorAndStaysOnUpload", async () => {
    // The `accept` attribute is only a picker hint, not an enforced filter —
    // browsers still let a user pick (or drag-and-drop) a non-matching file,
    // so disable user-event's default accept-filtering to exercise that path.
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);

    const input = screen.getByLabelText("Choose file", { selector: "input" });
    await user.upload(input, loadFixture("sample.txt", "text/plain"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/unsupported/i);
    expect(screen.getByText("current step: upload")).toBeInTheDocument();
  });

  it("test_uploadStep_duringDecode_dropzoneDisabledAndBusy", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText("Choose file", { selector: "input" });
    const uploadPromise = user.upload(input, loadFixture("sample.png", "image/png"));

    // `handleFile` sets the "decoding" status synchronously before the real
    // async decode work runs, so the dropzone should briefly reflect it —
    // guarding against a concurrent second drop/pick racing the first decode.
    await waitFor(() => {
      const dropzone = screen.getByRole("button", { name: /decoding/i });
      expect(dropzone).toBeDisabled();
      expect(dropzone).toHaveAttribute("aria-busy", "true");
    });
    expect(input).toBeDisabled();

    await uploadPromise;
    await waitFor(() => expect(screen.getByText("current step: edit")).toBeInTheDocument());
  });
});
