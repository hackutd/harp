import type { FieldValues, ResolverOptions } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ApplicationSchemaField } from "@/types";

import {
  applicantVisibleFields,
  buildDefaultValues,
  buildSchemaResolver,
  buildZodSchema,
  deriveSections,
  formatResponseValue,
  getObsoleteOptions,
  getResponseValue,
  groupFieldsBySection,
  hiddenFieldIds,
  isFieldVisible,
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
  // Conditions are resolved against the answers being validated, the same
  // way buildSchemaResolver feeds them in.
  return buildZodSchema(fields, values).safeParse(values);
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

  it("lets optional fields be left blank", () => {
    const fields = [
      field({ id: "nickname" }),
      field({ id: "bio", type: "textarea" }),
    ];
    // Optional text falls back to "", optional textarea accepts the "" that
    // buildDefaultValues seeds the form with.
    const result = validate(fields, { bio: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nickname).toBe("");
      expect(result.data.bio).toBe("");
    }
  });

  it("rejects whitespace-only answers to required text and textarea", () => {
    const fields = [
      field({ id: "name", required: true }),
      field({ id: "essay", type: "textarea", required: true }),
    ];
    expect(validate(fields, { name: "   ", essay: "ok" }).success).toBe(false);
    expect(validate(fields, { name: "ok", essay: "  \n " }).success).toBe(
      false,
    );
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

describe("phone validation (international E.164)", () => {
  it.each([
    ["+12145551234"],
    ["+18015550100"],
    ["+441234567890"],
    ["+1234567"], // 7 digits: the minimum
    ["+123456789012345"], // 15 digits: the maximum
  ])("accepts %s", (phone) => {
    expect(
      validate([field({ id: "p", type: "phone", required: true })], {
        p: phone,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["too short", "+123456"],
    ["too long", "+1234567890123456"],
    ["missing the plus", "12145551234"],
    ["a leading zero country code", "+02145551234"],
    ["non-canonical formatting", "(214) 555-1234"],
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
    expect(result.success).toBe(true);
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

describe("options that are no longer offered", () => {
  const size = field({
    id: "size",
    type: "select",
    required: true,
    options: ["S", "M"],
  });
  const skills = field({
    id: "skills",
    type: "multi_select",
    options: ["go", "rust"],
  });

  it("rejects a saved choice the schema no longer offers", () => {
    expect(validate([size], { size: "XL" }).success).toBe(false);
    expect(validate([skills], { skills: ["go", "cobol"] }).success).toBe(false);
  });

  it("lets drafts keep obsolete choices when options are not enforced", () => {
    const schema = buildZodSchema([size, skills], null, {
      enforceOptions: false,
    });
    expect(schema.safeParse({ size: "XL", skills: ["cobol"] }).success).toBe(
      true,
    );
  });

  it("reports each obsolete choice once", () => {
    expect(getObsoleteOptions(skills, ["cobol", "go", "cobol"])).toEqual([
      "cobol",
    ]);
    expect(getObsoleteOptions(size, "S")).toEqual([]);
    expect(getObsoleteOptions(field({ type: "text" }), "anything")).toEqual([]);
  });
});

describe("whole-number fields", () => {
  it("rejects fractional ages and holds the floor above a lower schema min", () => {
    const age = field({
      id: "age",
      type: "number",
      required: true,
      validation: { min: 0 },
    });
    expect(validate([age], { age: 20 }).success).toBe(true);
    expect(validate([age], { age: 20.5 }).success).toBe(false);
    expect(validate([age], { age: 0 }).success).toBe(false);
  });

  it("lets the schema raise the floor", () => {
    const age = field({
      id: "age",
      type: "number",
      required: true,
      validation: { min: 18 },
    });
    expect(validate([age], { age: 17 }).success).toBe(false);
    expect(validate([age], { age: 18 }).success).toBe(true);
  });

  it("fails an untouched required number and passes an untouched optional one", () => {
    expect(
      validate([field({ id: "n", type: "number", required: true })], {})
        .success,
    ).toBe(false);
    expect(validate([field({ id: "n", type: "number" })], {}).success).toBe(
      true,
    );
  });
});

describe("conditional fields (show_if / required_if)", () => {
  const optIn = field({ id: "travel", type: "checkbox" });
  const city = field({
    id: "city",
    required: true,
    validation: { show_if: "travel" },
  });
  const mode = field({
    id: "mode",
    type: "select",
    options: ["Flying", "Driving"],
  });
  const airport = field({
    id: "airport",
    validation: { required_if: "mode=Flying" },
  });

  it("does not require a hidden field", () => {
    expect(validate([optIn, city], { travel: false, city: "" }).success).toBe(
      true,
    );
    expect(isFieldVisible(city, { travel: false })).toBe(false);
  });

  it("requires a field once its checkbox controller shows it", () => {
    expect(validate([optIn, city], { travel: true, city: "" }).success).toBe(
      false,
    );
    expect(isFieldVisible(city, { travel: true })).toBe(true);
  });

  it("requires a field only when its select controller has the matching value", () => {
    expect(
      validate([mode, airport], { mode: "Driving", airport: "" }).success,
    ).toBe(true);
    expect(
      validate([mode, airport], { mode: "Flying", airport: "" }).success,
    ).toBe(false);
  });

  it("enforces conditions even while another field is still invalid", () => {
    // Zod skips object-level refinements once any property fails, which once
    // let an opted-in but empty travel section through until submit.
    const age = field({ id: "age", type: "number", required: true });
    const result = validate([age, optIn, city], { travel: true, city: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0])).toContain("city");
    }
  });

  it("re-evaluates conditions in the form resolver as answers change", async () => {
    const resolver = buildSchemaResolver([optIn, city]);
    const options = {
      fields: {},
      shouldUseNativeValidation: false,
    } as ResolverOptions<FieldValues>;

    const hidden = await resolver(
      { travel: false, city: "" },
      undefined,
      options,
    );
    expect(hidden.errors).toEqual({});

    const shown = await resolver(
      { travel: true, city: "" },
      undefined,
      options,
    );
    expect(shown.errors).toHaveProperty("city");
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
    // Numbers start blank so an untouched required number fails validation.
    expect(defaults).toEqual({ t: "", n: undefined, m: [], c: false });
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

describe("hiddenFieldIds / applicantVisibleFields", () => {
  const schema = [
    field({ id: "first_name" }),
    field({ id: "interview", type: "select", hidden: true, required: true }),
    field({
      id: "interview_ack",
      type: "checkbox",
      validation: { show_if: "interview=Yes", required_if: "interview=Yes" },
    }),
    field({ id: "interview_note", validation: { show_if: "interview_ack" } }),
    field({ id: "travel", type: "checkbox" }),
    field({ id: "travel_origin", validation: { show_if: "travel" } }),
  ];

  it("collects hidden fields and everything conditioned on them", () => {
    expect([...hiddenFieldIds(schema)]).toEqual([
      "interview",
      "interview_ack",
      "interview_note",
    ]);
  });

  it("withholds them from the applicant view and keeps the rest", () => {
    expect(applicantVisibleFields(schema).map((f) => f.id)).toEqual([
      "first_name",
      "travel",
      "travel_origin",
    ]);
  });

  it("returns the same array when nothing is hidden", () => {
    const plain = [field({ id: "a" }), field({ id: "b" })];
    expect(applicantVisibleFields(plain)).toBe(plain);
    expect(hiddenFieldIds(plain).size).toBe(0);
  });
});
