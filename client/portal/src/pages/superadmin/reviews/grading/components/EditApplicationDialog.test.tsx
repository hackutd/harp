import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Application, ApplicationSchemaField } from "@/types";

import { EditApplicationDialog } from "./EditApplicationDialog";

const SCHEMA: ApplicationSchemaField[] = [
  {
    id: "first_name",
    type: "text",
    label: "First name",
    required: true,
    section: "personal",
    display_order: 1,
  },
  {
    id: "major",
    type: "text",
    label: "Major",
    required: false,
    section: "personal",
    display_order: 2,
  },
];

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "1",
    user_id: "u1",
    status: "accepted",
    responses: { first_name: "Ada", major: "CS" },
    application_schema: SCHEMA,
    meal_group: null,
    resume_path: null,
    ai_score: null,
    verdict: null,
    classes: { human: null, ai: null, ai_edited: null, humanized: null },
    accept_votes: 0,
    reject_votes: 0,
    waitlist_votes: 0,
    reviews_assigned: 0,
    reviews_completed: 0,
    submitted_at: "2026-03-14T15:00:00Z",
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-14T15:00:00Z",
    rsvp_status: "pending",
    rsvp_responses: {},
    rsvp_submitted_at: null,
    travel_status: "not_requested",
    travel_yes_votes: 0,
    travel_no_votes: 0,
    travel_approved_amount_cents: null,
    travel_rsvp_status: "pending",
    travel_rsvp_responses: {},
    travel_rsvp_submitted_at: null,
    travel_receipt_paths: [],
    ...overrides,
  };
}

function renderDialog(
  overrides: Partial<Parameters<typeof EditApplicationDialog>[0]> = {},
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    application: application(),
    saving: false,
    onSave: vi.fn().mockResolvedValue(true),
    onReplaceResume: vi.fn(),
    onRemoveResume: vi.fn(),
    ...overrides,
  };
  render(<EditApplicationDialog {...props} />);
  return props;
}

describe("EditApplicationDialog", () => {
  it("starts from the saved answers with nothing to save", () => {
    renderDialog();

    expect(screen.getByLabelText("First name")).toHaveValue("Ada");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves only the answers that changed, then closes", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    // Labels gain an "edited" marker, so hold the inputs, not the label text.
    const firstName = screen.getByLabelText("First name");
    const major = screen.getByLabelText("Major");
    await user.clear(firstName);
    await user.type(firstName, "Grace");
    await user.clear(major);
    expect(screen.getByLabelText(/First name.*edited/)).toBe(firstName);
    await user.click(screen.getByRole("button", { name: "Save 2 changes" }));

    expect(props.onSave).toHaveBeenCalledWith({
      first_name: "Grace",
      major: null,
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open when the save fails", async () => {
    const user = userEvent.setup();
    const props = renderDialog({ onSave: vi.fn().mockResolvedValue(false) });

    await user.type(screen.getByLabelText("First name"), "!");
    await user.click(screen.getByRole("button", { name: "Save 1 change" }));

    expect(props.onSave).toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("uploads a PDF resume right away", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const props = renderDialog();
    const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });

    await user.upload(screen.getByLabelText("Resume PDF"), file);

    expect(props.onReplaceResume).toHaveBeenCalledWith(file);
  });

  it("refuses a resume that is not a PDF", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const props = renderDialog();
    const file = new File(["hi"], "resume.docx", {
      type: "application/msword",
    });

    await user.upload(screen.getByLabelText("Resume PDF"), file);

    expect(props.onReplaceResume).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Resume must be a PDF file.",
    );
  });

  it("removes the resume after confirmation", async () => {
    const user = userEvent.setup();
    const props = renderDialog({
      application: application({ resume_path: "hackathons/x/a.pdf" }),
    });

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onRemoveResume).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove resume" }));

    expect(props.onRemoveResume).toHaveBeenCalled();
  });
});
