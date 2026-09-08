import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationSchemaField } from "@/types";

import { useApplicationSchemaStore } from "./store";

const api = vi.hoisted(() => ({
  fetchApplicationSchema: vi.fn(),
  saveApplicationSchema: vi.fn(),
}));
vi.mock("./api", () => ({
  fetchApplicationSchema: api.fetchApplicationSchema,
  saveApplicationSchema: api.saveApplicationSchema,
}));

const errorAlert = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/api", () => ({ errorAlert }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function field(
  overrides: Partial<ApplicationSchemaField> = {},
): ApplicationSchemaField {
  return {
    id: "f1",
    type: "text",
    label: "Full name",
    required: false,
    section: "personal",
    display_order: 1,
    ...overrides,
  };
}

beforeEach(() => {
  useApplicationSchemaStore.setState({
    fields: [],
    sections: [],
    loading: false,
    saving: false,
  });
  vi.clearAllMocks();
});

describe("application-schema store: fetch", () => {
  it("loads fields and derives ordered sections", async () => {
    const fields = [
      field({
        id: "a",
        section: "personal",
        section_order: 2,
        display_order: 1,
      }),
      field({ id: "b", section: "skills", section_order: 1, display_order: 1 }),
    ];
    api.fetchApplicationSchema.mockResolvedValue({
      status: 200,
      data: { fields },
    });

    await useApplicationSchemaStore.getState().fetchSchema();

    const s = useApplicationSchemaStore.getState();
    expect(s.loading).toBe(false);
    expect(s.fields).toEqual(fields);
    expect(s.sections.map((sec) => sec.id)).toEqual(["skills", "personal"]);
  });
});

describe("application-schema store: field operations preserve ordering", () => {
  function seed() {
    const fields = [
      field({ id: "f1", section: "s", display_order: 1 }),
      field({ id: "f2", section: "s", display_order: 2 }),
      field({ id: "f3", section: "s", display_order: 3 }),
    ];
    useApplicationSchemaStore.setState({ fields });
  }

  it("adds and removes fields", () => {
    const f = field({ id: "new", section: "s" });
    useApplicationSchemaStore.getState().addField(f);
    expect(
      useApplicationSchemaStore.getState().fields.map((x) => x.id),
    ).toContain("new");

    useApplicationSchemaStore.getState().removeField("new");
    expect(
      useApplicationSchemaStore.getState().fields.map((x) => x.id),
    ).not.toContain("new");
  });

  it("updates a field while preserving the rest", () => {
    seed();
    useApplicationSchemaStore
      .getState()
      .updateField("f2", { label: "Renamed" });
    const s = useApplicationSchemaStore.getState();
    expect(s.fields.find((f) => f.id === "f2")?.label).toBe("Renamed");
    expect(s.fields).toHaveLength(3);
  });

  it("moves a field up and down within its section", () => {
    seed();
    useApplicationSchemaStore.getState().moveField("f3", "up");
    const s = useApplicationSchemaStore.getState();
    expect(s.fields.find((f) => f.id === "f3")?.display_order).toBe(2);

    useApplicationSchemaStore.getState().moveField("f1", "down");
    expect(
      useApplicationSchemaStore.getState().fields.find((f) => f.id === "f1")
        ?.display_order,
    ).toBe(2);
  });

  it("does not move a field past the top edge", () => {
    seed();
    useApplicationSchemaStore.getState().moveField("f1", "up");
    expect(
      useApplicationSchemaStore.getState().fields.find((f) => f.id === "f1")
        ?.display_order,
    ).toBe(1);
  });

  it("keeps validation rules when reordering", () => {
    useApplicationSchemaStore.setState({
      fields: [
        field({
          id: "f1",
          section: "s",
          type: "number",
          validation: { min: 1, max: 5 },
          display_order: 1,
        }),
        field({ id: "f2", section: "s", display_order: 2 }),
      ],
    });
    useApplicationSchemaStore.getState().moveField("f2", "up");
    const f1 = useApplicationSchemaStore
      .getState()
      .fields.find((f) => f.id === "f1")!;
    expect(f1.validation).toEqual({ min: 1, max: 5 });
  });
});

describe("application-schema store: section operations preserve order and rules", () => {
  it("adds, renames, and moves sections", () => {
    useApplicationSchemaStore.setState({
      sections: [
        { id: "s1", label: "One" },
        { id: "s2", label: "Two" },
      ],
    });
    useApplicationSchemaStore.getState().addSection("Brand new");
    useApplicationSchemaStore.getState().renameSection("s1", "First");
    expect(
      useApplicationSchemaStore.getState().sections.find((s) => s.id === "s1")
        ?.label,
    ).toBe("First");
    // renameSection also updates matching field labels
    useApplicationSchemaStore.setState({
      fields: [field({ id: "f1", section: "s1", section_label: "One" })],
    });
    useApplicationSchemaStore.getState().renameSection("s1", "First");
    expect(useApplicationSchemaStore.getState().fields[0].section_label).toBe(
      "First",
    );

    useApplicationSchemaStore.getState().moveSection("s2", "up");
    expect(useApplicationSchemaStore.getState().sections[0].id).toBe("s2");
  });

  it("removes a section and its fields together", () => {
    useApplicationSchemaStore.setState({
      sections: [{ id: "s1", label: "One" }],
      fields: [field({ id: "f1", section: "s1" })],
    });
    useApplicationSchemaStore.getState().removeSection("s1");
    expect(useApplicationSchemaStore.getState().sections).toEqual([]);
    expect(useApplicationSchemaStore.getState().fields).toEqual([]);
  });
});

describe("application-schema store: save validation", () => {
  it("blocks saving when a field has no label", async () => {
    useApplicationSchemaStore.setState({ fields: [field({ label: "  " })] });
    await useApplicationSchemaStore.getState().saveSchema();
    expect(toast.error).toHaveBeenCalledWith(
      "All fields must have a label before saving",
    );
    expect(api.saveApplicationSchema).not.toHaveBeenCalled();
  });

  it("blocks saving when a select has no options", async () => {
    useApplicationSchemaStore.setState({
      fields: [field({ id: "sel", type: "select", options: [] })],
    });
    await useApplicationSchemaStore.getState().saveSchema();
    expect(api.saveApplicationSchema).not.toHaveBeenCalled();
  });

  it("stamps section/order metadata and persists on success", async () => {
    const saved = [
      field({
        id: "f1",
        section: "s1",
        section_label: "One",
        section_order: 1,
        display_order: 1,
      }),
    ];
    api.saveApplicationSchema.mockResolvedValue({
      status: 200,
      data: { fields: saved },
    });
    useApplicationSchemaStore.setState({
      fields: [field({ id: "f1", section: "s1" })],
      sections: [{ id: "s1", label: "One" }],
    });

    await useApplicationSchemaStore.getState().saveSchema();

    expect(api.saveApplicationSchema).toHaveBeenCalledTimes(1);
    const sent = (
      api.saveApplicationSchema.mock.calls[0][0] as ApplicationSchemaField[]
    )[0];
    expect(sent.section_label).toBe("One");
    expect(sent.section_order).toBe(1);
    expect(useApplicationSchemaStore.getState().saving).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Application schema saved");
  });
});
