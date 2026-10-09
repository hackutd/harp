import { IconEye, IconId, IconShieldExclamation } from "@tabler/icons-react";

import { Switch } from "@/components/ui/switch";
import { useUserStore } from "@/shared/stores";

import type { DirectoryMe } from "../types";
import { useDirectoryVisibility } from "../useDirectoryVisibility";
import { INTENT_STYLES, intentLabel, ownCardPreview } from "../utils";
import { CardEditorForm } from "./CardEditorForm";
import { CardDetails, Chip } from "./DirectoryCard";

interface ProfileAboutProps {
  me: DirectoryMe;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}

// Who the hacker is: status, skills, links and the rest, shown on the Profile
// page as part of the profile itself. The Directory shows the same details.
// Only rendered for confirmed attendees.
export function ProfileAbout({
  me,
  editing,
  onEdit,
  onDone,
}: ProfileAboutProps) {
  const photoUrl = useUserStore((s) => s.user?.profilePictureUrl ?? null);
  const profile = me.profile;

  if (editing) {
    return (
      <div className="mt-2 text-ink">
        {/* Remount only when the profile is created. Visibility and Discord
            changes also bump updated_at, and remounting on those would wipe
            unsaved edits. */}
        <CardEditorForm
          key={profile ? "edit" : "new"}
          me={me}
          onSaved={onDone}
          onCancel={onDone}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="mt-5 flex w-full items-center gap-3 rounded-xl border border-ice/30 px-5 py-4 text-left transition-colors hover:border-ink/30"
      >
        <IconId className="size-4.5 text-ink" strokeWidth={1.5} />
        <span>
          <span className="block text-sm font-normal text-ink">
            Finish your profile
          </span>
          <span className="block text-xs font-light text-ink/65">
            Add your status, skills, and links so other hackers can find you in
            the Directory
          </span>
        </span>
      </button>
    );
  }

  const card = ownCardPreview(profile, photoUrl, me.status_stale);
  return (
    <div className="mt-4 text-ink">
      <div className="flex flex-wrap gap-1.5">
        <Chip className={INTENT_STYLES[card.intent]}>
          {intentLabel(card.intent, card.spots_needed)}
        </Chip>
      </div>
      <CardDetails card={card} />
      {profile.moderation_hidden && (
        <p className="mt-3 flex items-center gap-2 text-xs font-light text-ink/65">
          <IconShieldExclamation
            className="size-3.5 shrink-0"
            strokeWidth={1.75}
          />
          An organizer hid your profile from the Directory.
        </p>
      )}
    </div>
  );
}

interface DirectoryVisibilityRowProps {
  me: DirectoryMe;
}

// The Settings row for whether the profile shows up in the Directory.
export function DirectoryVisibilityRow({ me }: DirectoryVisibilityRowProps) {
  const { discoverable, busy, setDiscoverable } = useDirectoryVisibility();
  const profile = me.profile;

  return (
    <div className="flex min-h-[68px] items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <IconEye className="size-4.5 text-ink" strokeWidth={1.5} />
        <div>
          <label
            htmlFor="profile-directory-discoverable"
            className="block text-sm font-normal text-ink"
          >
            Show me in the Directory
          </label>
          <p className="text-xs font-light text-ink/65">
            {profile?.moderation_hidden
              ? "An organizer hid your profile, so it isn't shown right now"
              : discoverable
                ? "Other hackers can find, poke, and save you"
                : profile
                  ? "Hidden. You can still browse and keep your matches"
                  : "You'll start hidden when you finish your profile"}
          </p>
        </div>
      </div>
      <Switch
        id="profile-directory-discoverable"
        checked={discoverable}
        disabled={busy}
        onCheckedChange={setDiscoverable}
      />
    </div>
  );
}
