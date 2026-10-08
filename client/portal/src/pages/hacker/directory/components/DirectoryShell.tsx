import {
  IconChevronRight,
  IconId,
  IconShieldExclamation,
  IconUser,
} from "@tabler/icons-react";
import { type ReactNode, useEffect } from "react";
import { Link, Navigate } from "react-router";

import { HackerPageLoader } from "@/components/HackerPageLoader";
import { cn } from "@/shared/lib/utils";

import { useDirectoryStore } from "../store";
import type { DirectoryMe, DirectoryPoker, UnseenPokes } from "../types";
import { initials, pokedYouSummary } from "../utils";

export type DirectoryTab = "browse" | "pokes" | "contacts";

const TABS: { id: DirectoryTab; label: string; to: string }[] = [
  { id: "browse", label: "Browse", to: "/app/directory" },
  { id: "pokes", label: "Pokes", to: "/app/directory?tab=pokes" },
  { id: "contacts", label: "My contacts", to: "/app/directory/contacts" },
];

// Fills the full width with as many cards as fit, so wider windows get more
// columns rather than bigger cards. The minimum card width steps up on large
// screens so a full-screen window doesn't shrink them to thumbnails; the min()
// keeps phones at two columns.
export const CARD_GRID = cn(
  "grid gap-3 [--card-min:9rem] lg:[--card-min:11.5rem] xl:[--card-min:13rem] 2xl:[--card-min:14rem]",
  "grid-cols-[repeat(auto-fill,minmax(min(var(--card-min),calc(50%_-_0.375rem)),1fr))]",
);

export function CardGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD_GRID, className)}>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="aspect-[2/3] animate-pulse rounded-[3px] bg-ink/[0.04]"
        />
      ))}
    </div>
  );
}

interface DirectoryTabsProps {
  active: DirectoryTab;
}

// Browse and contacts get equal billing: both are top-level tabs here.
// Plain Links rather than NavLink: Browse and Pokes share a pathname, and
// NavLink would mark both as the current page. The header outlives tab
// switches, so the highlight slides across instead of jumping.
export function DirectoryTabs({ active }: DirectoryTabsProps) {
  const unseen = useDirectoryStore((s) => s.unseenPokes?.count ?? 0);
  const activeIndex = TABS.findIndex((t) => t.id === active);
  return (
    <nav
      aria-label="Directory"
      className="relative mt-5 grid max-w-xl grid-cols-3 gap-1 rounded-full border border-ink/10 p-1"
    >
      {/* One tab wide (the track less its padding and two gaps, over three);
          each step is a tab plus a gap. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-1rem)/3)] rounded-full bg-surface transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{
          transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))`,
        }}
      />
      {TABS.map((t) => (
        <Link
          key={t.id}
          to={t.to}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "relative inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm font-light transition-colors duration-300",
            active === t.id ? "text-ink" : "text-ink/65 hover:text-ink",
          )}
        >
          {t.label}
          {t.id === "pokes" && unseen > 0 && (
            <>
              <span
                aria-hidden
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-tide px-1 text-[10px] font-medium text-white tabular-nums"
              >
                {unseen > 9 ? "9+" : unseen}
              </span>
              <span className="sr-only">, {unseen} new</span>
            </>
          )}
        </Link>
      ))}
    </nav>
  );
}

function PokerAvatar({ poker }: { poker: DirectoryPoker }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-[10px] font-medium text-ink ring-2 ring-canvas">
      {poker.headshot_url ? (
        <img
          src={poker.headshot_url}
          alt=""
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        initials(poker.display_name)
      )}
    </span>
  );
}

// Who poked you since you last looked, for anyone who missed (or never
// enabled) the push. Opening Pokes clears it.
function PokedYouBubble({ unseen }: { unseen: UnseenPokes }) {
  return (
    <Link
      to="/app/directory?tab=pokes"
      className="mt-3 flex w-fit max-w-full items-center gap-3 rounded-full border border-ice/30 bg-ice/10 py-1.5 pr-3 pl-1.5 text-sm font-light text-ink transition-colors hover:bg-ice/15"
    >
      <span className="flex shrink-0 -space-x-2">
        {unseen.pokers.map((p) => (
          <PokerAvatar key={p.user_id} poker={p} />
        ))}
      </span>
      <span className="min-w-0 truncate">{pokedYouSummary(unseen)}</span>
      <IconChevronRight className="size-4 shrink-0 text-ink/65" />
    </Link>
  );
}

interface DirectoryHeaderProps {
  title: string;
  active: DirectoryTab;
}

export function DirectoryHeader({ title, active }: DirectoryHeaderProps) {
  const unseen = useDirectoryStore((s) => s.unseenPokes);
  const fetchUnseenPokes = useDirectoryStore((s) => s.fetchUnseenPokes);

  // Pokes marks its own list seen, so it has nothing to fetch.
  useEffect(() => {
    if (active === "pokes") return;
    const controller = new AbortController();
    fetchUnseenPokes(controller.signal);
    return () => controller.abort();
  }, [active, fetchUnseenPokes]);

  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-light tracking-tight text-ink">{title}</h1>
        <Link
          to="/app/profile"
          className="inline-flex items-center gap-1.5 text-sm font-light text-ink/65 transition-colors hover:text-ink"
        >
          <IconUser className="size-4" strokeWidth={1.5} />
          My profile
        </Link>
      </div>
      <DirectoryTabs active={active} />
      {active !== "pokes" && unseen && unseen.count > 0 && (
        <PokedYouBubble unseen={unseen} />
      )}
    </header>
  );
}

interface NoticeProps {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

function Notice({ icon, title, body, action }: NoticeProps) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-ice/30 bg-surface p-6 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-ink/10 text-ink">
        {icon}
      </div>
      <h2 className="mt-3 text-lg font-light">{title}</h2>
      <p className="mt-1 text-sm font-light text-ink/75">{body}</p>
      {action}
    </div>
  );
}

interface DirectoryGateProps {
  children: (me: DirectoryMe) => ReactNode;
}

// Browsing needs a confirmed RSVP and a finished profile. Without the RSVP the
// page doesn't exist; without a profile it explains what to do next.
export function DirectoryGate({ children }: DirectoryGateProps) {
  const me = useDirectoryStore((s) => s.me);
  const meLoading = useDirectoryStore((s) => s.meLoading);
  const fetchMe = useDirectoryStore((s) => s.fetchMe);

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal);
    return () => controller.abort();
  }, [fetchMe]);

  // An eligible card renders straight from cache; anything else waits for the
  // refresh so a stale answer can't bounce a newly confirmed hacker home.
  if (meLoading && !me?.eligible) return <HackerPageLoader />;

  const wrap = (node: ReactNode) => (
    <div className="mx-auto max-w-2xl px-5 pt-10 pb-6 text-ink">{node}</div>
  );

  // The directory is hidden from everyone without a confirmed RSVP, so a
  // direct link just goes home rather than advertising what's locked.
  if (!me || !me.eligible) return <Navigate to="/app" replace />;

  if (!me.profile) {
    return wrap(
      <Notice
        icon={<IconId className="size-5" />}
        title="Finish your profile to open the Directory"
        body="Your profile is how other hackers find you. It takes a minute, and you can hide it any time."
        action={
          <Link
            to="/app/profile?edit=1"
            className="mt-4 inline-flex rounded-full bg-tide px-5 py-2 text-sm font-medium text-white hover:bg-tide-hover"
          >
            Finish my profile
          </Link>
        }
      />,
    );
  }

  if (me.profile.moderation_hidden) {
    return wrap(
      <Notice
        icon={<IconShieldExclamation className="size-5" />}
        title="Your profile is under review"
        body="An organizer hid your profile from the directory. Reach out to the team if you think this is a mistake."
      />,
    );
  }

  return <>{children(me)}</>;
}
