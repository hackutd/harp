import { BADGE_COLORS } from "@/shared/lib/badge-colors";
import type { UserRole } from "@/types";

export const MIN_SEARCH_LENGTH = 2;

export const roleLabels: Record<UserRole, string> = {
  hacker: "Hacker",
  admin: "Admin",
  super_admin: "Super Admin",
};

export const allRoles: UserRole[] = ["super_admin", "admin", "hacker"];

export const roleActiveStyles: Record<UserRole, string> = {
  hacker: `${BADGE_COLORS.neutral} hover:opacity-90`,
  admin: `${BADGE_COLORS.blue} hover:opacity-90`,
  super_admin: `${BADGE_COLORS.purple} hover:opacity-90`,
};

export const roleInactiveStyles =
  "bg-transparent text-muted-foreground border-dashed hover:bg-muted";

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatUserName(
  firstName: string | null,
  lastName: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export function getUserInitial(
  firstName: string | null,
  email: string,
): string {
  return (firstName?.[0] ?? email[0] ?? "").toUpperCase();
}
