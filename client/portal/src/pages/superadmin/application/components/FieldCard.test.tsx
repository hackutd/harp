import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ApplicationSchemaField } from "@/types";

import type { SchemaFieldContract } from "../contract";
import { FieldCard } from "./FieldCard";

function field(
  overrides: Partial<ApplicationSchemaField> = {},
): ApplicationSchemaField {
  return {
    id: "interview",
    type: "select",
    label: "On-site interviews?",
    required: true,
    section: "links",
    display_order: 0,
    options: ["Yes", "No"],
    ...overrides,
  };
}

function renderCard(
  f: ApplicationSchemaField,
  props: { contract?: SchemaFieldContract } = {},
) {
  const onUpdate = vi.fn();
  render(
    <FieldCard
      field={f}
      availableFields={[f]}
      onUpdate={onUpdate}
      onRemove={vi.fn()}
      onMove={vi.fn()}
      isFirst
      isLast
      {...props}
    />,
  );
  return { onUpdate };
}

describe("FieldCard hidden toggle", () => {
  it("hides a field from applicants", async () => {
    const { onUpdate } = renderCard(field());

    expect(
      screen.getByRole("switch", { name: "Hidden from applicants" }),
    ).not.toBeChecked();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("switch", { name: "Hidden from applicants" }),
    );

    expect(onUpdate).toHaveBeenCalledWith({ hidden: true });
  });

  it("shows the hidden badge and clears the flag when switched back", async () => {
    const { onUpdate } = renderCard(field({ hidden: true }));

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", {
      name: "Hidden from applicants",
    });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    expect(onUpdate).toHaveBeenCalledWith({ hidden: undefined });
  });

  it("explains what a hidden system field turns off", () => {
    const contract: SchemaFieldContract = {
      field_id: "travel_reimbursement",
      required_type: "checkbox",
      purpose: "Travel reimbursement opt-in",
      inactive_warning: "No travel checkbox: travel review is off.",
      hidden_warning: "Hidden travel checkbox: new submissions skip travel.",
    };
    renderCard(
      field({ id: "travel_reimbursement", type: "checkbox", hidden: true }),
      { contract },
    );

    expect(
      screen.getByText("Hidden travel checkbox: new submissions skip travel."),
    ).toBeInTheDocument();
  });
});
