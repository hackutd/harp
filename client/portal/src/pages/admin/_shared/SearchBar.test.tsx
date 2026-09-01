import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// External boundaries mocked at module level per testing conventions.
// SearchBar itself doesn't use SuperTokens/Sonner, but these are the project's
// standard boundaries and mocking them keeps future refactors from dragging
// auth/toast side effects into the test environment.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("supertokens-auth-react", () => ({}));

import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  const onChange = vi.fn();

  function renderBar(value = "") {
    return render(<SearchBar value={value} onChange={onChange} />);
  }

  beforeEach(() => {
    onChange.mockClear();
  });

  it("renders a collapsed search button when closed", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Search by name or email"),
    ).not.toBeInTheDocument();
  });

  it("opens the search input on click", async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search by name or email"),
      ).toBeInTheDocument();
    });
  });

  it("propagates typed values to onChange", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: "Search" }));
    const input = await screen.findByPlaceholderText("Search by name or email");

    await user.type(input, "ada");

    expect(onChange).toHaveBeenNthCalledWith(1, "a");
    expect(onChange).toHaveBeenNthCalledWith(2, "d");
    expect(onChange).toHaveBeenNthCalledWith(3, "a");
  });

  it("stays open on blur while populated", async () => {
    const user = userEvent.setup();
    // Parent keeps `value` populated after typing.
    const { rerender } = render(<SearchBar value="" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Search" }));
    rerender(<SearchBar value="ada" onChange={onChange} />);

    await user.tab(); // move focus away -> blur

    expect(
      screen.getByPlaceholderText("Search by name or email"),
    ).toBeInTheDocument();
  });

  it("closes on blur when empty", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: "Search" }));

    await user.tab(); // blur without typing

    expect(
      screen.queryByPlaceholderText("Search by name or email"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("clears and closes on Escape", async () => {
    const user = userEvent.setup();
    renderBar("ada"); // starts open because value is populated
    const input = screen.getByPlaceholderText("Search by name or email");

    await user.type(input, "{Escape}");

    expect(onChange).toHaveBeenCalledWith("");
    expect(
      screen.queryByPlaceholderText("Search by name or email"),
    ).not.toBeInTheDocument();
  });
});
