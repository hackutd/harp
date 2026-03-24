import type { UserRole } from "@/types";

export const MIN_SEARCH_LENGTH = 2;

export const roleLabels: Record<UserRole, string> = {
  hacker: "Hacker",
  admin: "Admin",
  super_admin: "Super Admin",
};

export const allRoles: UserRole[] = ["super_admin", "admin", "hacker"];

export const roleActiveStyles: Record<UserRole, string> = {
  hacker: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  admin: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  super_admin: "bg-indigo-400 text-white hover:bg-indigo-500",
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
  return (firstName?.[0] ?? email[0]).toUpperCase();
}
