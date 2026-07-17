import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

describe("App wizard shell", () => {
  it("test_app_initialRender_showsUploadStep", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "1. Upload" })).toBeInTheDocument();
  });

  it("test_app_clickNext_advancesToEditStep", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "2. Edit" })).toBeInTheDocument();
  });
});
