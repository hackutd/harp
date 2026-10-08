import { IconEyeOff, IconRotate } from "@tabler/icons-react";
import { memo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { DirectoryAdminProfile, DirectoryCardStatus } from "../types";
import { cardStatus } from "../utils";

const STATUS_BADGES: Record<
  DirectoryCardStatus,
  { label: string; variant: "red" | "neutral" | "green" }
> = {
  moderated: { label: "Hidden by admin", variant: "red" },
  hidden_by_owner: { label: "Hidden by owner", variant: "neutral" },
  visible: { label: "Visible", variant: "green" },
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

interface ModerationTableProps {
  profiles: DirectoryAdminProfile[];
  saving: Record<string, boolean>;
  onHide: (profile: DirectoryAdminProfile) => void;
  onRestore: (profile: DirectoryAdminProfile) => void;
}

export const ModerationTable = memo(function ModerationTable({
  profiles,
  saving,
  onHide,
  onRestore,
}: ModerationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Attendee</TableHead>
          <TableHead>Card content</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((profile) => {
          const status = cardStatus(profile);
          const badge = STATUS_BADGES[status];
          return (
            <TableRow key={profile.user_id} className="align-top">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    {profile.headshot_url && (
                      <AvatarImage
                        src={profile.headshot_url}
                        alt={`${profile.display_name}'s photo`}
                      />
                    )}
                    <AvatarFallback>
                      {initials(profile.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {profile.display_name}
                      {profile.pronouns && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {profile.pronouns}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile.email}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-md space-y-1 text-sm whitespace-normal">
                {profile.want_to_build && (
                  <p>
                    <span className="text-muted-foreground">
                      Wants to build{" "}
                    </span>
                    {profile.want_to_build}
                  </p>
                )}
                {profile.icebreaker_answer && (
                  <p>
                    <span className="text-muted-foreground">
                      {profile.icebreaker_prompt}{" "}
                    </span>
                    {profile.icebreaker_answer}
                  </p>
                )}
                {profile.skills.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Skills: {profile.skills.join(", ")}
                  </p>
                )}
                {profile.experiences.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Experience:{" "}
                    {profile.experiences
                      .map((e) => `${e.title} at ${e.company}`)
                      .join(", ")}
                  </p>
                )}
                {(profile.github_username || profile.linkedin_handle) && (
                  <p className="text-xs text-muted-foreground">
                    {[
                      profile.github_username &&
                        `GitHub: ${profile.github_username}`,
                      profile.linkedin_handle &&
                        `LinkedIn: ${profile.linkedin_handle}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {status === "moderated" && profile.moderation_reason && (
                  <p className="mt-1 max-w-48 text-xs whitespace-normal text-muted-foreground">
                    {profile.moderation_reason}
                  </p>
                )}
              </TableCell>
              <TableCell>
                {status === "moderated" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer bg-admin-panel hover:bg-surface-2"
                    disabled={saving[profile.user_id]}
                    onClick={() => onRestore(profile)}
                  >
                    <IconRotate className="size-4" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer bg-admin-panel hover:bg-surface-2"
                    disabled={saving[profile.user_id]}
                    onClick={() => onHide(profile)}
                  >
                    <IconEyeOff className="size-4" />
                    Hide
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
});
