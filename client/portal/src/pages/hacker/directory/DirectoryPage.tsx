import {
  BadgeCheck,
  EyeOff,
  Layers,
  LayoutGrid,
  RefreshCw,
  Search,
  SkipForward,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { errorAlert } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

import { confirmDirectoryStatus } from "./api";
import { SwipeCoachMark } from "./components/CoachMark";
import { DirectoryCard } from "./components/DirectoryCard";
import { DirectoryGate, DirectoryHeader } from "./components/DirectoryShell";
import { SwipeableCard } from "./components/SwipeableCard";
import { useDirectoryStore } from "./store";
import type { DirectoryIntent, DirectoryMe } from "./types";
import { INTENT_LABELS } from "./utils";

const SEARCH_DEBOUNCE_MS = 400;

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "border-[#21FFF0]/50 bg-[#21FFF0]/12 text-[#21FFF0]"
          : "border-white/12 text-white/65 hover:border-white/25 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function StatusNudge({ me }: { me: DirectoryMe }) {
  const setMe = useDirectoryStore((s) => s.setMe);
  const [busy, setBusy] = useState(false);
  if (!me.status_stale || !me.profile) return null;

  const handleConfirm = async () => {
    setBusy(true);
    const res = await confirmDirectoryStatus();
    setBusy(false);
    if (res.status === 200 && res.data) {
      setMe(res.data);
      toast.success("Status confirmed");
    } else {
      errorAlert(res);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#FFC83D]/30 bg-[#FFC83D]/[0.06] px-4 py-3">
      <RefreshCw className="size-4 shrink-0 text-[#FFD86B]" />
      <p className="flex-1 text-sm font-light text-white/85">
        Still <b className="font-medium">{INTENT_LABELS[me.profile.intent]}</b>?
        Cards that haven't been confirmed in a few days sink to the bottom.
      </p>
      <div className="flex gap-2">
        <Link
          to="/app/directory/card"
          className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/80 hover:bg-white/5"
        >
          Update
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={handleConfirm}
          className="rounded-full bg-[#5900FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#6D1CFF] disabled:opacity-60"
        >
          Still accurate
        </button>
      </div>
    </div>
  );
}

function BrowseView({ me }: { me: DirectoryMe }) {
  const filters = useDirectoryStore((s) => s.filters);
  const setFilters = useDirectoryStore((s) => s.setFilters);
  const cards = useDirectoryStore((s) => s.cards);
  const loading = useDirectoryStore((s) => s.loading);
  const loadingMore = useDirectoryStore((s) => s.loadingMore);
  const nextCursor = useDirectoryStore((s) => s.nextCursor);
  const busy = useDirectoryStore((s) => s.busy);
  const fetchCards = useDirectoryStore((s) => s.fetchCards);
  const fetchMore = useDirectoryStore((s) => s.fetchMore);
  const poke = useDirectoryStore((s) => s.poke);
  const toggleContact = useDirectoryStore((s) => s.toggleContact);
  const hide = useDirectoryStore((s) => s.hide);
  const unhide = useDirectoryStore((s) => s.unhide);

  const [search, setSearch] = useState(filters.q);
  const [reviewMode, setReviewMode] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const firstSearch = useRef(true);

  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    const t = setTimeout(() => setFilters({ q: search }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, setFilters]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCards(controller.signal);
    return () => controller.abort();
  }, [filters, fetchCards]);

  const queue = useMemo(
    () =>
      cards.filter(
        (c) => !c.poked_by_me && !c.is_hidden && !skipped.has(c.user_id),
      ),
    [cards, skipped],
  );
  const top = queue[0];
  const reviewing = reviewMode && !filters.hidden;

  useEffect(() => {
    if (reviewing && queue.length < 3 && nextCursor) void fetchMore();
  }, [reviewing, queue.length, nextCursor, fetchMore]);

  const intents = me.options.intents as DirectoryIntent[];

  return (
    <>
      <StatusNudge me={me} />
      {me.profile && !me.profile.discoverable && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm font-light text-white/75">
          <EyeOff className="size-4 shrink-0 text-white/55" />
          <p className="flex-1">
            Your card is hidden, so new people can't poke or save you. You can
            still browse.
          </p>
          <Link
            to="/app/directory/card"
            className="text-xs text-[#21FFF0] hover:underline"
          >
            Change
          </Link>
        </div>
      )}

      <section aria-label="Filters" className="mt-4 space-y-2.5">
        <div className="flex gap-2">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-full border border-white/12 bg-[#0B0C15]/80 px-4 focus-within:border-[#21FFF0]/45">
            <Search className="size-4 text-white/45" />
            <span className="sr-only">Search names and skills</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search names and skills"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setReviewMode((v) => !v)}
            aria-pressed={reviewMode}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-xs font-medium text-white/75 hover:text-white md:hidden"
          >
            {reviewMode ? (
              <>
                <LayoutGrid className="size-4" /> Grid
              </>
            ) : (
              <>
                <Layers className="size-4" /> Quick review
              </>
            )}
          </button>
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <FilterChip
            active={filters.checkedIn}
            onClick={() => setFilters({ checkedIn: !filters.checkedIn })}
          >
            <BadgeCheck className="size-3.5" /> Checked in
          </FilterChip>
          {intents.map((intent) => (
            <FilterChip
              key={intent}
              active={filters.intents.includes(intent)}
              onClick={() =>
                setFilters({ intents: toggle(filters.intents, intent) })
              }
            >
              {INTENT_LABELS[intent]}
            </FilterChip>
          ))}
          <FilterChip
            active={filters.hidden}
            onClick={() => setFilters({ hidden: !filters.hidden })}
          >
            <EyeOff className="size-3.5" /> Hidden
          </FilterChip>
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {me.options.interest_tags.map((tag) => (
            <FilterChip
              key={tag}
              active={filters.tags.includes(tag)}
              onClick={() => setFilters({ tags: toggle(filters.tags, tag) })}
            >
              {tag}
            </FilterChip>
          ))}
        </div>
      </section>

      <div className="mt-4">
        <SwipeCoachMark />
      </div>

      {filters.hidden && (
        <p className="mb-3 text-sm font-light text-white/60">
          People you've hidden. Unhide someone to put them back in the
          directory.
        </p>
      )}

      {loading && cards.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-white/8 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : reviewing ? (
        <div className="mx-auto max-w-sm">
          {top ? (
            <>
              <SwipeableCard
                key={top.user_id}
                onSwipeRight={() => void poke(top)}
                onSwipeLeft={() => void hide(top)}
                disabled={busy[top.user_id]}
              >
                <DirectoryCard card={top} hideActions className="min-h-80" />
              </SwipeableCard>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void hide(top)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/75"
                >
                  <EyeOff className="size-4" /> Hide
                </button>
                <button
                  type="button"
                  onClick={() => setSkipped((s) => new Set(s).add(top.user_id))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/75"
                >
                  <SkipForward className="size-4" /> Skip
                </button>
                <button
                  type="button"
                  onClick={() => void poke(top)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#5900FF] px-4 py-2 text-sm font-medium text-white"
                >
                  Poke
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-white/45">
                {queue.length} to review
              </p>
            </>
          ) : (
            <p className="py-16 text-center text-sm font-light text-white/60">
              You're all caught up.
            </p>
          )}
        </div>
      ) : cards.length === 0 ? (
        <p className="py-16 text-center text-sm font-light text-white/60">
          {filters.hidden
            ? "You haven't hidden anyone."
            : "No one matches those filters yet."}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <SwipeableCard
                key={card.user_id}
                disabled={card.is_hidden || busy[card.user_id]}
                onSwipeRight={() => {
                  if (!card.poked_by_me) void poke(card);
                }}
                onSwipeLeft={() => void hide(card)}
              >
                <DirectoryCard
                  card={card}
                  busy={busy[card.user_id]}
                  onPoke={poke}
                  onToggleContact={toggleContact}
                  onHide={hide}
                  onUnhide={(c) => void unhide(c)}
                />
              </SwipeableCard>
            ))}
          </div>
          {nextCursor && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void fetchMore()}
                className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/80 hover:bg-white/5 disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PokesView() {
  const pokes = useDirectoryStore((s) => s.pokes);
  const pokesLoading = useDirectoryStore((s) => s.pokesLoading);
  const busy = useDirectoryStore((s) => s.busy);
  const fetchPokes = useDirectoryStore((s) => s.fetchPokes);
  const poke = useDirectoryStore((s) => s.poke);
  const toggleContact = useDirectoryStore((s) => s.toggleContact);

  useEffect(() => {
    const controller = new AbortController();
    fetchPokes(controller.signal);
    return () => controller.abort();
  }, [fetchPokes]);

  if (pokesLoading && pokes.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/50">Loading...</p>
    );
  }
  if (pokes.length === 0) {
    return (
      <p className="py-16 text-center text-sm font-light text-white/60">
        No pokes yet. When someone pokes you, they show up here so you can poke
        back.
      </p>
    );
  }
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pokes.map((card) => (
        <DirectoryCard
          key={card.user_id}
          card={card}
          busy={busy[card.user_id]}
          onPoke={poke}
          onToggleContact={toggleContact}
        />
      ))}
    </div>
  );
}

export default function DirectoryPage() {
  const [params] = useSearchParams();
  const tab = params.get("tab") === "pokes" ? "pokes" : "browse";

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-5 pt-4 pb-6 text-white md:max-w-5xl md:px-8 md:pt-6">
      <DirectoryGate>
        {(me) => (
          <>
            <DirectoryHeader
              title={tab === "pokes" ? "Poked you" : "Who's Attending"}
              active={tab}
            />
            {tab === "pokes" ? <PokesView /> : <BrowseView me={me} />}
          </>
        )}
      </DirectoryGate>
    </div>
  );
}
