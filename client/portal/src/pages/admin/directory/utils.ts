import type { DirectoryAdminProfile, DirectoryCardStatus } from "./types";

// Moderation wins over the owner's own visibility: a moderated card stays
// hidden even if its owner turns discoverability back on.
export function cardStatus(
  profile: DirectoryAdminProfile,
): DirectoryCardStatus {
  if (profile.moderation_hidden_at) return "moderated";
  if (!profile.discoverable) return "hidden_by_owner";
  return "visible";
}

export const MODERATION_REASON_MAX = 300;
