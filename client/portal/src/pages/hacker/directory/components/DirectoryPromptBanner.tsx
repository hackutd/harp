import { ChevronRight, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { fetchDirectoryMe } from "../api";
import type { DirectoryMe } from "../types";

// Dashboard nudge for confirmed hackers: make a card, or re-confirm a stale
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
      to="/app/directory/card"
      className="mt-5 flex items-center gap-3 rounded-xl border border-[#21FFF0]/25 bg-[#0B0C15]/92 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(33,255,240,0.14),rgba(33,255,240,0)_55%)] p-4 transition-colors hover:border-[#21FFF0]/45"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#21FFF0]/10 text-[#21FFF0]">
        <Users className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-white">
          {stale ? "Is your status still right?" : "See who's attending"}
        </span>
        <span className="mt-0.5 block text-xs font-light text-white/60">
          {stale
            ? "The event is close. Confirm your card so people know you're still looking."
            : "Make your directory card to browse other hackers, poke people, and swap Discord."}
        </span>
      </span>
      <ChevronRight className="size-4 text-white/50" />
    </Link>
  );
}
