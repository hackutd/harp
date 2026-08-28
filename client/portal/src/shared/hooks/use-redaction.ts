import { useUserStore } from "@/shared/stores";

/**
 * Whether applicant identity should be hidden from the current viewer.
 *
 * True for admins, false for super admins. Reads the same store the route
 * guards check, which every admin page has already populated by the time it
 * renders. Fails closed: an unresolved role redacts rather than flashing names
 * on screen.
 */
export function useRedactApplicants(): boolean {
  const user = useUserStore((s) => s.user);
  return user?.role !== "super_admin";
}
