import { IdCard, Lock, ShieldAlert } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Link, NavLink } from "react-router";

import { HackerPageLoader } from "@/components/HackerPageLoader";
import { cn } from "@/shared/lib/utils";

import { useDirectoryStore } from "../store";
import type { DirectoryMe } from "../types";

const TABS = [
  { label: "Browse", to: "/app/directory", tab: null },
  { label: "Poked you", to: "/app/directory?tab=pokes", tab: "pokes" },
  { label: "My contacts", to: "/app/directory/contacts", tab: null },
] as const;

interface DirectoryTabsProps {
  active: "browse" | "pokes" | "contacts";
}

// Browse and contacts get equal billing: both are top-level tabs here.
export function DirectoryTabs({ active }: DirectoryTabsProps) {
  const keys = ["browse", "pokes", "contacts"] as const;
  return (
    <nav
      aria-label="Directory"
      className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-[#0B0C15]/80 p-1"
    >
      {TABS.map((t, i) => (
        <NavLink
          key={t.label}
          to={t.to}
          end
          aria-current={active === keys[i] ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-center text-xs font-medium tracking-wide uppercase transition-colors",
            active === keys[i]
              ? "bg-[#5900FF] text-white shadow-[0_0_16px_rgba(89,0,255,0.35)]"
              : "text-white/60 hover:text-white",
          )}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

interface DirectoryHeaderProps {
  title: string;
  active: "browse" | "pokes" | "contacts";
}

export function DirectoryHeader({ title, active }: DirectoryHeaderProps) {
  return (
    <header>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-[#21FFF0]/75 uppercase">
            Attendee directory
          </p>
          <h1 className="mt-1 text-2xl font-light tracking-tight">{title}</h1>
        </div>
        <Link
          to="/app/directory/card"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-[#21FFF0]/40 hover:text-white"
        >
          <IdCard className="size-3.5" strokeWidth={1.75} />
          My card
        </Link>
      </div>
      <DirectoryTabs active={active} />
    </header>
  );
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-[#A857FF]/25 bg-[#0B0C15]/92 bg-[radial-gradient(130%_130%_at_100%_100%,rgba(89,0,255,0.22),rgba(89,0,255,0)_58%)] p-6 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#5900FF]/25 text-[#D8C5FF]">
        {icon}
      </div>
      <h2 className="mt-3 text-lg font-light">{title}</h2>
      <p className="mt-1 text-sm font-light text-white/65">{body}</p>
      {action}
    </div>
  );
}

interface DirectoryGateProps {
  children: (me: DirectoryMe) => ReactNode;
}

// Browsing needs a confirmed RSVP and your own card. Anything short of that
// gets an explanation here instead of a failed request.
export function DirectoryGate({ children }: DirectoryGateProps) {
  const me = useDirectoryStore((s) => s.me);
  const meLoading = useDirectoryStore((s) => s.meLoading);
  const fetchMe = useDirectoryStore((s) => s.fetchMe);

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal);
    return () => controller.abort();
  }, [fetchMe]);

  if (meLoading && !me) return <HackerPageLoader />;

  const wrap = (node: ReactNode) => (
    <div className="mx-auto max-w-2xl px-5 pt-10 pb-6 text-white">{node}</div>
  );

  if (!me || !me.eligible) {
    return wrap(
      <Notice
        icon={<Lock className="size-5" />}
        title="Who's Attending opens after you RSVP"
        body="Once you're accepted and confirm your spot, you can make a card and see who else is coming."
        action={
          <Link
            to="/app"
            className="mt-4 inline-flex rounded-full border border-white/15 px-5 py-2 text-sm text-white/85 hover:bg-white/5"
          >
            Back to home
          </Link>
        }
      />,
    );
  }

  if (!me.profile) {
    return wrap(
      <Notice
        icon={<IdCard className="size-5" />}
        title="Make your card to see who's attending"
        body="Your card is how other hackers find you. It takes a minute, and you can hide it any time."
        action={
          <Link
            to="/app/directory/card"
            className="mt-4 inline-flex rounded-full bg-[#5900FF] px-5 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(89,0,255,0.28)] hover:bg-[#6D1CFF]"
          >
            Create my card
          </Link>
        }
      />,
    );
  }

  if (me.profile.moderation_hidden) {
    return wrap(
      <Notice
        icon={<ShieldAlert className="size-5" />}
        title="Your card is under review"
        body="An organizer hid your card from the directory. Reach out to the team if you think this is a mistake."
      />,
    );
  }

  return <>{children(me)}</>;
}
