export interface PhoneParts {
  countryCode: string;
  national: string;
}

// One/two-digit calling codes; the remaining international prefixes use three.
// https://www.rfc-editor.org/rfc/rfc5527.html#section-5.1
const TWO_DIGIT_CODES = new Set([
  "20",
  "27",
  "30",
  "31",
  "32",
  "33",
  "34",
  "36",
  "39",
  "40",
  "41",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "81",
  "82",
  "84",
  "86",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
  "98",
]);

/** Recover the separate inputs from an existing or pasted international value. */
export function splitPhoneNumber(value: string): PhoneParts {
  const digits = value.replace(/\D/g, "");
  if (!value.trim().startsWith("+"))
    return { countryCode: "1", national: digits };
  const length = /^[17]/.test(digits)
    ? 1
    : TWO_DIGIT_CODES.has(digits.slice(0, 2))
      ? 2
      : 3;
  return {
    countryCode: digits.slice(0, length),
    national: digits.slice(length),
  };
}

/** Formatting is cosmetic; never truncate a longer international number. */
export function formatPhoneNational({
  countryCode,
  national,
}: PhoneParts): string {
  if (!national) return "";
  if (countryCode === "1") {
    if (national.length < 4) return `(${national}`;
    if (national.length < 7)
      return `(${national.slice(0, 3)}) ${national.slice(3)}`;
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  // Other countries use neutral digit groups instead of imposing a US mask.
  const groups: string[] = [];
  let remaining = national;
  while (remaining.length > 4) {
    groups.push(remaining.slice(0, 3));
    remaining = remaining.slice(3);
  }
  return [...groups, remaining].join(" ");
}

export function joinPhoneNumber({ countryCode, national }: PhoneParts): string {
  if (!national) return "";
  // A blank country code must remain invalid instead of silently defaulting.
  return countryCode ? `+${countryCode}${national}` : national;
}
