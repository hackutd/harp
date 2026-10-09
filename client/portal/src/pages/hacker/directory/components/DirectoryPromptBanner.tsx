import { IconChevronRight, IconUsers } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { fetchDirectoryMe } from "../api";
import type { DirectoryMe } from "../types";

// Dashboard nudge for confirmed hackers: finish their profile, or re-confirm a stale
// status when the event is close.
export function DirectoryPromptBanner() {
  const [me, setMe] = useState<DirectoryMe | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchDirectoryMe(controller.signal).then((res) => {
      if (!controller.signal.aborted && res.status === 200 && res.data) {
        setMe(res.data);
      }
    });
    return () => controller.abort();
  }, []);

  if (!me?.eligible) return null;
  if (me.profile && !me.status_stale) return null;
  if (me.profile?.moderation_hidden) return null;

  const stale = Boolean(me.profile);
  return (
    <Link
      to="/app/profile?edit=1"
      className="hacker-application-card mt-4 flex items-center gap-3 rounded-xl bg-surface p-4 transition-colors hover:bg-surface-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink">
        <IconUsers className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">
          {stale ? "Is your status still right?" : "Open the Directory"}
        </span>
        <span className="mt-0.5 block text-xs font-light text-ink/65">
          {stale
            ? "The event is close. Confirm your status so people know you're still looking."
            : "Finish your profile to browse other hackers, poke people, and swap Discord."}
        </span>
      </span>
      <IconChevronRight className="size-4 text-ink/65" />
    </Link>
  );
}
