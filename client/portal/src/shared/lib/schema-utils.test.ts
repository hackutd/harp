import { describe, expect, it } from "vitest";

import type { ApplicationSchemaField } from "@/types";

import {
  buildDefaultValues,
  buildZodSchema,
  deriveSections,
  formatResponseValue,
  getResponseValue,
  groupFieldsBySection,
  stripLabelLinks,
} from "./schema-utils";

function field(
  overrides: Partial<ApplicationSchemaField> = {},
): ApplicationSchemaField {
  return {
    id: "f1",
    type: "text",
    label: "Full name",
    required: false,
    section: "personal",
    display_order: 0,
    ...overrides,
  };
}

function validate(
  fields: ApplicationSchemaField[],
  values: Record<string, unknown>,
) {
  return buildZodSchema(fields).safeParse(values);
}

describe("required and optional fields", () => {
  it("enforces required text and textarea before submission", () => {
    const fields = [
      field({ id: "name", required: true }),
      field({ id: "essay", type: "textarea", required: true }),
    ];
    expect(validate(fields, { name: "", essay: "" }).success).toBe(false);
    const ok = validate(fields, { name: "Ada", essay: "Hello" });
    expect(ok.success).toBe(true);
  });

  it("lets optional fields fall back to empty defaults", () => {
    const fields = [
      field({ id: "nickname" }),
      field({ id: "bio", type: "textarea" }),
    ];
    const result = validate(fields, {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nickname).toBe("");
      expect(result.data.bio).toBe("");
    }
  });

  it("reports which field failed with its label", () => {
    const result = validate(
      [field({ id: "name", required: true, label: "Full name" })],
      {
        name: "",
      },
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Full name");
    }
  });

  it("enforces textarea maxLength when configured", () => {
    const fields = [
      field({ id: "bio", type: "textarea", validation: { maxLength: 5 } }),
    ];
    expect(validate(fields, { bio: "12345" }).success).toBe(true);
    expect(validate(fields, { bio: "123456" }).success).toBe(false);
  });
});

describe("phone validation (US format)", () => {
  it.each([
    ["+12145551234", true],
    ["+18015550100", true],
  ])("accepts canonical %s", (phone) => {
    expect(
      validate([field({ id: "p", type: "phone", required: true })], {
        p: phone,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["invalid contact info: too short", "+1214555123"],
    ["non-canonical formatting", "(214) 555-1234"],
    ["wrong country code", "+441234567890"],
    ["letters present", "+1abc5551234"],
  ])("rejects %s", (_label, phone) => {
    expect(
      validate([field({ id: "p", type: "phone", required: true })], {
        p: phone,
      }).success,
    ).toBe(false);
  });

  it("requires a phone when required but allows blank when optional", () => {
    const fields = [field({ id: "p", type: "phone", required: true })];
    expect(validate(fields, {}).success).toBe(false);
    const optional = validate(
      [field({ id: "p", type: "phone", required: false })],
      { p: "" },
    );
    expect(optional.success).toBe(true);
  });
});

describe("numeric constraints", () => {
  const fields = [
    field({
      id: "age",
      type: "number",
      required: true,
      validation: { min: 18, max: 120 },
    }),
  ];

  it.each([
    ["within bounds", 21, true],
    ["at min bound", 18, true],
    ["at max bound", 120, true],
    ["below min", 17, false],
    ["above max", 121, false],
  ])("%s enforces configured bounds", (_label, value, success) => {
    expect(validate(fields, { age: value }).success).toBe(success);
  });

  it("coerces numeric strings from inputs", () => {
    expect(validate(fields, { age: "21" }).success).toBe(true);
  });

  it("defaults required numbers to a minimum of 0 when no min is configured", () => {
    const unbounded = [field({ id: "points", type: "number", required: true })];
    expect(validate(unbounded, { points: -1 }).success).toBe(false);
    expect(validate(unbounded, { points: 5 }).success).toBe(true);
  });
});

describe("select, multi-select, and checkbox semantics", () => {
  const fields = [
    field({
      id: "size",
      type: "select",
      required: true,
      options: ["S", "M", "L"],
    }),
    field({ id: "skills", type: "multi_select", options: ["go", "rust"] }),
    field({
      id: "agree",
      type: "checkbox",
      required: true,
      label: "Code of Conduct",
    }),
  ];

  it("requires select values before submission and preserves valid choices", () => {
    expect(
      validate(fields, { size: "", skills: [], agree: true }).success,
    ).toBe(false);
    expect(
      validate(fields, { size: "M", skills: [], agree: true }).success,
    ).toBe(true);
  });

  it("preserves multi-select arrays as defaults and values", () => {
    const result = validate(fields, { size: "S", agree: true, skills: ["go"] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.skills).toEqual(["go"]);
  });

  it("keeps multi-select defaulting to [] when omitted", () => {
    const result = validate(fields, { size: "S", agree: true });
    if (result.success) expect(result.data.skills).toEqual([]);
  });

  it("requires an explicit true for required checkboxes", () => {
    expect(
      validate(fields, { size: "S", skills: [], agree: false }).success,
    ).toBe(false);
  });

  it("defaults optional checkboxes to false", () => {
    const optionalOnly = [
      field({ id: "newsletter", type: "checkbox", required: false }),
    ];
    const result = validate(optionalOnly, {});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.newsletter).toBe(false);
  });
});

describe("buildDefaultValues", () => {
  it("maps each field type to its intended default", () => {
    const defaults = buildDefaultValues([
      field({ id: "t", type: "text" }),
      field({ id: "n", type: "number" }),
      field({ id: "m", type: "multi_select" }),
      field({ id: "c", type: "checkbox" }),
    ]);
    expect(defaults).toEqual({ t: "", n: 0, m: [], c: false });
  });
});

describe("section derivation and grouping preserve order", () => {
  it("orders sections by section_order and falls back for legacy data", () => {
    const sections = deriveSections([
      field({ section: "agreements", section_order: 3 }),
      field({
        section: "personal",
        section_label: "About You",
        section_order: 1,
      }),
      field({ section: "legacy_section", section_order: 2 }), // no label → falls back
    ]);
    expect(sections.map((s) => s.id)).toEqual([
      "personal",
      "legacy_section",
      "agreements",
    ]);
    expect(sections[0].label).toBe("About You");
    expect(sections[1].label).toBe("legacy_section");
  });

  it("sorts fields by display_order within each section", () => {
    const groups = groupFieldsBySection([
      field({ id: "b", section: "s", display_order: 2 }),
      field({ id: "a", section: "s", display_order: 1 }),
    ]);
    expect(groups.s.map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("response helpers", () => {
  it("returns typed values with fallbacks for missing responses", () => {
    expect(getResponseValue({ q1: "yes" }, "q1", "")).toBe("yes");
    expect(getResponseValue({ q1: null }, "q1", "fallback")).toBe("fallback");
    expect(getResponseValue(undefined, "q1", 42)).toBe(42);
    expect(getResponseValue(null, "q1", 42)).toBe(42);
  });

  it("formats response values per field type including empties", () => {
    const multi = field({ id: "m", type: "multi_select" });
    expect(formatResponseValue(["a", "b"], multi)).toBe("a, b");
    expect(formatResponseValue([], multi)).toBe("None");
    expect(
      formatResponseValue(true, field({ id: "c", type: "checkbox" })),
    ).toBe("Yes");
    expect(
      formatResponseValue(false, field({ id: "c", type: "checkbox" })),
    ).toBe("No");
    expect(formatResponseValue("", field())).toBe("Not provided");
    expect(formatResponseValue(null, field())).toBe("Not provided");
  });
});

describe("stripLabelLinks", () => {
  it("keeps link text while dropping markdown URLs", () => {
    expect(stripLabelLinks("See [our rules](https://example.com) first")).toBe(
      "See our rules first",
    );
    expect(stripLabelLinks("plain label")).toBe("plain label");
  });
});
