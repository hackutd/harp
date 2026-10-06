import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { useTabToFocusNotes } from "./useTabToFocusNotes";

function Harness({ enabled = true }: { enabled?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  useTabToFocusNotes(panelRef, notesRef, enabled);

  return (
    <>
      <button>Outside</button>
      <div ref={panelRef}>
        <textarea aria-label="Notes" ref={notesRef} />
        <button>Accept</button>
      </div>
      {/* After the panel, so normal tabbing never lands on the notes. */}
      <input aria-label="Search" />
      <div role="dialog">
        <button>In dialog</button>
      </div>
      <button>After</button>
    </>
  );
}

describe("useTabToFocusNotes", () => {
  it("focuses the notes when nothing is focused", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();

    expect(screen.getByLabelText("Notes")).toHaveFocus();
  });

  it("focuses the notes from a control outside the panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: "Outside" }).focus();

    await user.tab();

    expect(screen.getByLabelText("Notes")).toHaveFocus();
  });

  it("focuses the notes from a control after the panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: "After" }).focus();

    await user.tab();

    expect(screen.getByLabelText("Notes")).toHaveFocus();
  });

  it("keeps normal tabbing inside the panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByLabelText("Notes").focus();

    await user.tab();

    expect(screen.getByRole("button", { name: "Accept" })).toHaveFocus();
  });

  it("leaves inputs and dialogs alone", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByLabelText("Search").focus();
    await user.tab();
    expect(screen.getByLabelText("Notes")).not.toHaveFocus();

    screen.getByRole("button", { name: "In dialog" }).focus();
    await user.tab();
    expect(screen.getByLabelText("Notes")).not.toHaveFocus();
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    render(<Harness enabled={false} />);
    screen.getByRole("button", { name: "After" }).focus();

    await user.tab();

    expect(screen.getByLabelText("Notes")).not.toHaveFocus();
  });
});
