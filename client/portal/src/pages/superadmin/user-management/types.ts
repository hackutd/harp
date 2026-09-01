import type { UserRole } from "@/types";

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url?: string | null;
  created_at: string;
  review_assignment_enabled: boolean | null;
}

export interface UserListResponse {
  users: AdminUser[];
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}

export interface FetchUsersParams {
  search?: string;
  cursor?: string;
  direction?: "forward" | "backward";
  roles?: UserRole[];
}

export interface PendingRoleChange {
  userId: string;
  email: string;
  newRole: UserRole;
}
