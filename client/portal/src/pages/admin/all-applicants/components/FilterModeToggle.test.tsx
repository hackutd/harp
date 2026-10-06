import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterModeToggle } from "./FilterModeToggle";

describe("FilterModeToggle", () => {
  it("marks the active mode as pressed", () => {
    render(<FilterModeToggle mode="event" onModeChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Event" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Status" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("switches to the other mode", async () => {
    const onModeChange = vi.fn();
    render(<FilterModeToggle mode="status" onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Event" }));
    expect(onModeChange).toHaveBeenCalledWith("event");
  });

  it("does not deselect when the active mode is clicked again", async () => {
    const onModeChange = vi.fn();
    render(<FilterModeToggle mode="status" onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Status" }));
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
