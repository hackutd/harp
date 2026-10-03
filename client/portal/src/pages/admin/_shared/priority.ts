/**
 * Applications submitted by this instant count as priority. Oct 3, 2026 at
 * 11:59 PM Central (CDT, UTC-5).
 */
export const PRIORITY_DEADLINE = new Date("2026-10-03T23:59:59.999-05:00");

export function isPriorityApplication(
  submittedAt: string | null | undefined,
): boolean {
  if (!submittedAt) return false;
  const submitted = new Date(submittedAt);
  return !Number.isNaN(submitted.getTime()) && submitted <= PRIORITY_DEADLINE;
}
