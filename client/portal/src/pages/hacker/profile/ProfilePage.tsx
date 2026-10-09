import { IconSettings } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { AdminPortalButton } from "@/components/AdminPortalButton";
import { ProfilePhotoEditor } from "@/components/ProfilePhotoEditor";
import { getRequest } from "@/shared/lib/api";
import {
  usePointsConfigStore,
  useSettingsDialogStore,
  useUserStore,
} from "@/shared/stores";
import type { Application } from "@/types";

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

  const name = displayName(application);

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

      {/* Identity */}
      <div className="rounded-xl bg-surface px-5 py-4 theme-light:border theme-light:border-ink/10">
        <ProfilePhotoEditor fallback={initials(name, user?.email)}>
          <p className="truncate text-lg font-normal text-ink">
            {name ?? "Hacker"}
          </p>
          {user?.email && (
            <p className="truncate text-sm font-light text-ink/65">
              {user.email}
            </p>
          )}
        </ProfilePhotoEditor>
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
