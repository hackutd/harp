import { IconPencil, IconSettings } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { AdminPortalButton } from "@/components/AdminPortalButton";
import { ProfilePhotoEditor } from "@/components/ProfilePhotoEditor";
import { getRequest } from "@/shared/lib/api";
import {
  useAttendeeStore,
  usePointsConfigStore,
  useSettingsDialogStore,
  useUserStore,
} from "@/shared/stores";
import type { Application } from "@/types";

import { ProfileAbout } from "../directory/components/ProfileAbout";
import { useDirectoryStore } from "../directory/store";
import { AccountRows, SettingsGroup } from "../settings";

function displayName(application: Application | null): string | null {
  const responses = application?.responses ?? {};
  const first = responses["first_name"];
  const last = responses["last_name"];
  const parts = [first, last].filter(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

function initials(name: string | null, email?: string): string {
  if (name) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export default function ProfilePage() {
  const user = useUserStore((s) => s.user);
  const openSettings = useSettingsDialogStore((s) => s.setOpen);

  const pointsName = usePointsConfigStore((s) => s.pointsName);
  const pointsEnabled = usePointsConfigStore((s) => s.pointsEnabled);
  const fetchPointsConfig = usePointsConfigStore((s) => s.fetchPointsConfig);

  const [application, setApplication] = useState<Application | null>(null);
  const attendee = useAttendeeStore(
    (s) => s.confirmed && s.userId != null && s.userId === user?.id,
  );
  const directoryMe = useDirectoryStore((s) => s.me);
  const fetchDirectoryMe = useDirectoryStore((s) => s.fetchMe);
  // Status, skills, links and the rest only exist once the RSVP is confirmed.
  const about = attendee && directoryMe?.eligible ? directoryMe : null;

  // Editing lives in the URL so the Directory and the dashboard nudge can
  // link straight into it.
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = about != null && searchParams.get("edit") === "1";
  const setEditing = (on: boolean) =>
    setSearchParams(on ? { edit: "1" } : {}, { replace: true });

  useEffect(() => {
    if (!attendee) return;
    const controller = new AbortController();
    fetchDirectoryMe(controller.signal);
    return () => controller.abort();
  }, [attendee, fetchDirectoryMe]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await getRequest<Application>(
        "/applications/me",
        "application",
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setApplication(res.data);
      }
    };
    load();
    fetchPointsConfig(controller.signal);
    return () => controller.abort();
  }, [fetchPointsConfig]);

  const name = about?.profile?.display_name || displayName(application);
  const pronouns = about?.profile?.pronouns;

  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 pb-8 md:max-w-5xl md:px-8 md:pt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-light tracking-tight text-ink">Profile</h1>
        <button
          type="button"
          onClick={() => openSettings(true)}
          aria-label="Settings"
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <IconSettings className="size-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Identity and profile details, in one card. This is the same profile
          The Directory shows. */}
      <div className="rounded-xl bg-surface px-5 py-4 theme-light:border theme-light:border-ink/10">
        <ProfilePhotoEditor
          fallback={initials(name, user?.email)}
          name={name}
          action={
            about?.profile &&
            !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex shrink-0 items-center gap-1.5 self-start -mr-1 rounded-full border border-ink/15 px-4 py-1.5 text-sm font-light text-ink/85 transition-colors hover:border-ink/30 hover:text-ink"
              >
                <IconPencil className="size-3.5" strokeWidth={1.75} />
                Edit profile
              </button>
            )
          }
        >
          <p className="truncate text-lg font-normal text-ink">
            {name ?? "Hacker"}
            {pronouns && (
              <span className="ml-2 text-sm font-light text-ink/65">
                {pronouns}
              </span>
            )}
          </p>
          {user?.email && (
            <p className="truncate text-sm font-light text-ink/65">
              {user.email}
            </p>
          )}
        </ProfilePhotoEditor>

        {about && (
          <ProfileAbout
            me={about}
            editing={editing}
            onEdit={() => setEditing(true)}
            onDone={() => setEditing(false)}
          />
        )}
      </div>

      {/* Points — hidden entirely when super admins turn the system off */}
      {pointsEnabled && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface px-5 py-4 theme-light:border theme-light:border-ink/10">
          <div>
            <p className="text-sm font-normal text-ink">{pointsName}</p>
            <p className="text-xs font-light text-ink/65">
              Earned from check-ins and events
            </p>
          </div>
          <span className="text-2xl font-light text-ink tabular-nums">
            {application?.points ?? 0}
          </span>
        </div>
      )}

      {/* Meal group — assigned at check-in, so absent until then */}
      {application?.meal_group && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface px-5 py-4 theme-light:border theme-light:border-ink/10">
          <div>
            <p className="text-sm font-normal text-ink">Meal group</p>
            <p className="text-xs font-light text-ink/65">
              Show this at meal lines
            </p>
          </div>
          <span className="text-2xl font-light text-ink">
            {application.meal_group}
          </span>
        </div>
      )}

      {/* Account. Settings live in the Settings dialog (the gear above, or
          the sidebar's account menu); the account actions are in both. */}
      <div className="mt-6">
        <SettingsGroup
          title="Account"
          className="bg-surface theme-light:border theme-light:border-ink/10"
        >
          <AccountRows />
        </SettingsGroup>
      </div>

      <div className="mt-6">
        <AdminPortalButton />
      </div>
    </div>
  );
}
