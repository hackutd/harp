export function formatName(
  firstName: string | null,
  lastName: string | null,
): string {
  if (!firstName && !lastName) return "-";
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}
