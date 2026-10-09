import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconEyeOff,
  IconLayoutGrid,
  IconPlayerSkipForward,
  IconRefresh,
  IconStack2,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchBar } from "@/pages/admin/_shared/SearchBar";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { errorAlert } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";
import { useSettingsDialogStore } from "@/shared/stores";

import { confirmDirectoryStatus } from "./api";
import { SwipeCoachMark } from "./components/CoachMark";
import { DirectoryCard } from "./components/DirectoryCard";
import { CARD_GRID, CardGridSkeleton } from "./components/DirectoryShell";
import { SwipeableCard } from "./components/SwipeableCard";
import { PokesView } from "./PokesView";
import { useDirectoryStore } from "./store";
import type { DirectoryMe } from "./types";
import { INTENT_LABELS } from "./utils";

const SEARCH_DEBOUNCE_MS = 400;

interface FilterOption {
  value: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}

interface FilterMenuProps {
  label: string;
  options: FilterOption[];
}

// One filter group behind a dropdown. Picking an option keeps the menu open
// so several can be ticked in a row.
function FilterMenu({ label, options }: FilterMenuProps) {
  const count = options.filter((o) => o.checked).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-light transition-colors",
            count > 0
              ? "border-ice text-ink"
              : "border-ink/10 text-ink/65 hover:text-ink",
          )}
        >
          {label}
          {count > 0 && <span className="tabular-nums">· {count}</span>}
          <IconChevronDown className="size-3.5" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-56 w-max min-w-0 overflow-y-auto"
      >
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={o.checked}
            onCheckedChange={o.onToggle}
            onSelect={(e) => e.preventDefault()}
            // The tick sits on the right so labels line up flush left.
            className="pr-8 pl-3 [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const pageButton =
  "inline-flex h-9 items-center gap-1 rounded-full border border-ink/15 px-3.5 text-sm font-light text-ink/85 transition-colors hover:bg-ink/[0.03] disabled:pointer-events-none disabled:opacity-40";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

interface DirectoryMeProps {
  me: DirectoryMe;
}

function StatusNudge({ me }: DirectoryMeProps) {
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
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
      <IconRefresh className="size-4 shrink-0 text-amber-300" />
      <p className="flex-1 text-sm font-light text-ink/85">
        Still <b className="font-medium">{INTENT_LABELS[me.profile.intent]}</b>?
        Cards that haven't been confirmed in a few days sink to the bottom.
      </p>
      <div className="flex gap-2">
        <Link
          to="/app/profile?edit=1"
          className="rounded-full border border-ink/15 px-3.5 py-1.5 text-xs text-ink/85 hover:bg-ink/[0.03]"
        >
          Update
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={handleConfirm}
          className="rounded-full bg-tide px-3.5 py-1.5 text-xs font-medium text-white hover:bg-tide-hover disabled:opacity-60"
        >
          Still accurate
        </button>
      </div>
    </div>
  );
}

function BrowseView({ me }: DirectoryMeProps) {
  const openSettings = useSettingsDialogStore((s) => s.setOpen);
  const filters = useDirectoryStore((s) => s.filters);
  const setFilters = useDirectoryStore((s) => s.setFilters);
  const cards = useDirectoryStore((s) => s.cards);
  const loading = useDirectoryStore((s) => s.loading);
  const nextCursor = useDirectoryStore((s) => s.nextCursor);
  const page = useDirectoryStore((s) => s.pageCursors.length);
  const busy = useDirectoryStore((s) => s.busy);
  const fetchCards = useDirectoryStore((s) => s.fetchCards);
  const fetchMore = useDirectoryStore((s) => s.fetchMore);
  const goToPage = useDirectoryStore((s) => s.goToPage);
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
  // Quick review is a mobile-only mode; its toggle is hidden on desktop.
  const isMobile = useIsMobile();
  const reviewing = reviewMode && isMobile && !filters.hidden;

  useEffect(() => {
    if (reviewing && queue.length < 3 && nextCursor) void fetchMore();
  }, [reviewing, queue.length, nextCursor, fetchMore]);

  // Review tops its queue up by appending pages, so the grid it hands back to
  // no longer lines up with a page; start it over from page 1.
  const wasReviewing = useRef(reviewing);
  useEffect(() => {
    if (wasReviewing.current && !reviewing) void fetchCards();
    wasReviewing.current = reviewing;
  }, [reviewing, fetchCards]);

  const changePage = async (direction: "next" | "prev") => {
    await goToPage(direction);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const intents = me.options.intents;
  const filtered =
    filters.intents.length > 0 ||
    filters.tags.length > 0 ||
    filters.checkedIn ||
    filters.hidden;

  return (
    <>
      <StatusNudge me={me} />
      {me.profile && !me.profile.discoverable && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-sm font-light text-ink/75">
          <IconEyeOff className="size-4 shrink-0 text-ink/65" />
          <p className="flex-1">
            You're hidden, so new people can't poke or save you. You can still
            browse.
          </p>
          {/* Visibility lives in the Settings dialog. */}
          <button
            type="button"
            onClick={() => openSettings(true)}
            className="text-xs text-ice hover:underline"
          >
            Change
          </button>
        </div>
      )}

      <section
        aria-label="Filters"
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <FilterMenu
          label="Status"
          options={intents.map((intent) => ({
            value: intent,
            label: INTENT_LABELS[intent],
            checked: filters.intents.includes(intent),
            onToggle: () =>
              setFilters({ intents: toggle(filters.intents, intent) }),
          }))}
        />
        <FilterMenu
          label="Interests"
          options={me.options.interest_tags.map((tag) => ({
            value: tag,
            label: tag,
            checked: filters.tags.includes(tag),
            onToggle: () => setFilters({ tags: toggle(filters.tags, tag) }),
          }))}
        />
        <FilterMenu
          label="More"
          options={[
            {
              value: "checked_in",
              label: "Checked in only",
              checked: filters.checkedIn,
              onToggle: () => setFilters({ checkedIn: !filters.checkedIn }),
            },
            {
              value: "hidden",
              label: "People I've hidden",
              checked: filters.hidden,
              onToggle: () => setFilters({ hidden: !filters.hidden }),
            },
          ]}
        />
        {filtered && (
          <button
            type="button"
            onClick={() =>
              setFilters({
                intents: [],
                tags: [],
                checkedIn: false,
                hidden: false,
              })
            }
            className="px-1 text-sm font-light text-ink/65 hover:text-ink"
          >
            Clear
          </button>
        )}
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search name or skill"
        />
        <button
          type="button"
          onClick={() => setReviewMode((v) => !v)}
          aria-pressed={reviewMode}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/10 px-3.5 text-sm font-light text-ink/65 hover:text-ink md:hidden"
        >
          {reviewMode ? (
            <>
              <IconLayoutGrid className="size-4" /> Grid
            </>
          ) : (
            <>
              <IconStack2 className="size-4" /> Review
            </>
          )}
        </button>
      </section>

      <div className="mt-4">
        <SwipeCoachMark />
      </div>

      {filters.hidden && (
        <p className="mb-3 text-sm font-light text-ink/65">
          People you've hidden. Unhide someone to put them back in the
          directory.
        </p>
      )}

      {loading && cards.length === 0 ? (
        <CardGridSkeleton />
      ) : reviewing ? (
        <div className="mx-auto max-w-xs">
          {top ? (
            <>
              <SwipeableCard
                key={top.user_id}
                onSwipeRight={() => void poke(top)}
                onSwipeLeft={() => void hide(top)}
                disabled={busy[top.user_id]}
              >
                <DirectoryCard card={top} hideActions detailed />
              </SwipeableCard>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void hide(top)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/75"
                >
                  <IconEyeOff className="size-4" /> Hide
                </button>
                <button
                  type="button"
                  onClick={() => setSkipped((s) => new Set(s).add(top.user_id))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/75"
                >
                  <IconPlayerSkipForward className="size-4" /> Skip
                </button>
                <button
                  type="button"
                  onClick={() => void poke(top)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tide px-4 py-2 text-sm font-medium text-white"
                >
                  Poke
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-ink/55">
                {queue.length} to review
              </p>
            </>
          ) : (
            <p className="py-16 text-center text-sm font-light text-ink/65">
              You're all caught up.
            </p>
          )}
        </div>
      ) : cards.length === 0 ? (
        <p className="py-16 text-center text-sm font-light text-ink/65">
          {filters.hidden
            ? "You haven't hidden anyone."
            : "No one matches those filters yet."}
        </p>
      ) : (
        <>
          <div
            className={cn(
              CARD_GRID,
              "transition-opacity",
              loading && "opacity-60",
            )}
          >
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
                  onUnhide={unhide}
                />
              </SwipeableCard>
            ))}
          </div>
          {(page > 1 || nextCursor) && (
            <nav
              aria-label="Pagination"
              className="mt-6 flex items-center justify-center gap-3"
            >
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void changePage("prev")}
                className={pageButton}
              >
                <IconChevronLeft className="size-4" strokeWidth={1.75} />
                Prev
              </button>
              <span className="min-w-16 text-center text-sm font-light text-ink/65 tabular-nums">
                Page {page}
              </span>
              <button
                type="button"
                disabled={!nextCursor || loading}
                onClick={() => void changePage("next")}
                className={pageButton}
              >
                Next
                <IconChevronRight className="size-4" strokeWidth={1.75} />
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

// Browse and Pokes share a pathname; the tab rides in the query string.
export default function DirectoryPage() {
  const me = useOutletContext<DirectoryMe>();
  const [params] = useSearchParams();
  return params.get("tab") === "pokes" ? <PokesView /> : <BrowseView me={me} />;
}
