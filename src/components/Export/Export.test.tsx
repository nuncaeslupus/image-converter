import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { Export } from "./Export";

const SAMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><path d="M0 0h10v10H0z"/></svg>';

/**
 * `@testing-library/user-event` installs its own `navigator.clipboard`
 * getter-only stub (see `attachClipboardStubToView` in its `Clipboard.js`)
 * the first time `userEvent.setup()` runs in this jsdom window — after that,
 * a plain `Object.assign(navigator, { clipboard: ... })` throws ("has only a
 * getter") because it goes through `[[Set]]`, not a fresh property
 * definition. `Object.defineProperty` replaces the whole (configurable)
 * descriptor instead, so it works both before and after user-event has
 * installed its stub.
 */
function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("Export", () => {
  it("test_export_zeroWidth_ignoredAndMarkedInvalid", async () => {
    const user = userEvent.setup();
    render(<Export svg={SAMPLE_SVG} defaultFileName="image.svg" />);

    const widthInput = screen.getByLabelText("Width");
    await user.clear(widthInput);
    await user.type(widthInput, "0");

    expect(widthInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/width must be a positive number/i);
  });

  it("test_export_negativeHeight_ignoredAndMarkedInvalid", async () => {
    const user = userEvent.setup();
    render(<Export svg={SAMPLE_SVG} defaultFileName="image.svg" />);

    const heightInput = screen.getByLabelText("Height");
    await user.clear(heightInput);
    await user.type(heightInput, "-5");

    expect(heightInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/height must be a positive number/i);
  });

  it("test_export_validSizeThenInvalid_keepsLastValidSizeForCopy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<Export svg={SAMPLE_SVG} defaultFileName="image.svg" />);

    const widthInput = screen.getByLabelText("Width");
    await user.clear(widthInput);
    await user.type(widthInput, "200");
    // A single atomic overwrite (not clear() + type(), which would pass
    // through an intermediate blank/"auto" value — itself valid, and would
    // reset the "last valid" tracking to blank) so this exercises exactly
    // "the field goes straight from one valid value to an invalid one".
    fireEvent.input(widthInput, { target: { value: "0" } }); // invalid — should NOT override the 200

    await user.click(screen.getByRole("button", { name: "SVG markup" }));
    await user.click(screen.getByRole("button", { name: /copy svg markup/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('width="200"'));
  });

  it("test_export_copySuccess_showsCopiedFeedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<Export svg={SAMPLE_SVG} defaultFileName="image.svg" />);

    await user.click(screen.getByRole("button", { name: "SVG markup" }));
    await user.click(screen.getByRole("button", { name: /copy svg markup/i }));

    await waitFor(() => expect(screen.getByText("Copied!")).toBeInTheDocument());
  });

  it("test_export_copyFailure_showsFailedFeedbackInsteadOfUnhandledRejection", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<Export svg={SAMPLE_SVG} defaultFileName="image.svg" />);

    await user.click(screen.getByRole("button", { name: "SVG markup" }));
    await user.click(screen.getByRole("button", { name: /copy svg markup/i }));

    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
  });

  it("test_export_unmountShortlyAfterCopy_doesNotWarnAboutSetStateAfterUnmount", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    stubClipboard(writeText);
    const { unmount } = render(<Export svg={SAMPLE_SVG} defaultFileName="image.svg" />);

    await user.click(screen.getByRole("button", { name: "SVG markup" }));
    await user.click(screen.getByRole("button", { name: /copy svg markup/i }));
    await waitFor(() => expect(screen.getByText("Copied!")).toBeInTheDocument());
    unmount();

    // Let the (cleared) revert-to-idle timeout's original delay elapse —
    // if the cleanup effect didn't clear it, this would fire setState on an
    // unmounted component.
    await new Promise((resolve) => setTimeout(resolve, 1600));

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
