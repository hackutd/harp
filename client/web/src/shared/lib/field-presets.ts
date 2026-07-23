import { COUNTRIES } from "@/shared/data/countries";
import { MAJORS } from "@/shared/data/majors";
import { UNIVERSITIES } from "@/shared/data/universities";

/**
 * Maps an application schema field `id` to a curated list of preset options.
 *
 * Fields listed here render a searchable combobox (type-to-filter) with an
 * "Other" escape hatch for free text, instead of a plain input — even though
 * their schema `type` stays "text". Because the stored value remains a plain
 * string (the picked preset or the free-typed value), nothing on the backend
 * or admin-review side needs to change; presets only normalize the common case.
 *
 * Keyed by field id (not type) so it applies to exactly the well-known fields
 * — see issue #96. Add an id here to give another field the same behavior.
 */
const FIELD_PRESETS: Record<string, readonly string[]> = {
  university: UNIVERSITIES,
  major: MAJORS,
  country_of_residence: COUNTRIES,
  race: [
    "American Indian or Alaska Native",
    "Asian",
    "Black or African American",
    "Native Hawaiian or Pacific Islander",
    "White",
    "Two or more races",
    "Prefer not to say",
  ],
  ethnicity: [
    "Hispanic or Latino",
    "Not Hispanic or Latino",
    "Prefer not to say",
  ],
};

/** Preset options for a field id, or undefined if it has none. */
export function getFieldPresets(
  fieldId: string,
): readonly string[] | undefined {
  return FIELD_PRESETS[fieldId];
}