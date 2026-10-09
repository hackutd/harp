import { IconHandStop } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import { memo, useEffect, useState } from "react";
import { Link } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/shared/lib/utils";

import { CardDialog } from "./components/CardDialog";
import { MatchDiscordButton } from "./components/DirectoryCard";
import { useDirectoryStore } from "./store";
import type { DirectoryCardData } from "./types";
import {
  groupPokes,
  initials,
  intentLabel,
  openOnRowClick,
  type PokeSection,
} from "./utils";

const SECTIONS: { id: PokeSection; title: string; hint: string }[] = [
  {
    id: "waiting",
    title: "Waiting on you",
    hint: "Poke back to match and swap Discord.",
  },
  {
    id: "matched",
    title: "Matched",
    hint: "You both poked, so Discord is unlocked.",
  },
  {
    id: "sent",
    title: "You poked",
    hint: "When they poke back, you'll match.",
  },
];

function ago(at: string | undefined): string {
  return at
    ? formatDistanceToNowStrict(new Date(at), { addSuffix: true })
    : "just now";
}

function detail(card: DirectoryCardData, section: PokeSection): string {
  const status = intentLabel(card.intent, card.spots_needed);
  if (section === "waiting")
    return `Poked you ${ago(card.related_at)} · ${status}`;
  if (section === "sent") return `You poked ${ago(card.related_at)}`;
  return status;
}

interface PokeRowProps {
  card: DirectoryCardData;
  section: PokeSection;
  busy?: boolean;
  onOpen: (userID: string) => void;
  onPoke: (card: DirectoryCardData) => void;
}

const PokeRow = memo(function PokeRow({
  card,
  section,
  busy,
  onOpen,
  onPoke,
}: PokeRowProps) {
  return (
    <li
      onClick={openOnRowClick(() => onOpen(card.user_id))}
      className="flex animate-in cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-300 fade-in-0 hover:bg-ink/[0.03] motion-reduce:animate-none md:px-5"
    >
      <Avatar
        className={cn(
          "size-11 shrink-0 border border-ink/10",
          section === "sent" && "opacity-70",
        )}
      >
        {card.headshot_url && (
          <AvatarImage
            src={card.headshot_url}
            alt=""
            className="object-cover"
          />
        )}
        <AvatarFallback className="bg-surface-2 text-sm font-light text-ink">
          {initials(card.display_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(card.user_id)}
          aria-label={`View ${card.display_name}'s profile`}
          className={cn(
            "block max-w-full truncate text-left text-sm font-normal",
            section === "sent" ? "text-ink/75" : "text-ink",
          )}
        >
          {card.display_name}
          {card.pronouns && (
            <span className="ml-1.5 text-xs font-light text-ink/65">
              {card.pronouns}
            </span>
          )}
        </button>
        <p className="truncate text-xs font-light text-ink/65">
          {detail(card, section)}
        </p>
      </div>
      {section === "waiting" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPoke(card)}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-tide px-4 text-xs font-medium text-white transition-colors hover:bg-tide-hover active:scale-[0.98] disabled:opacity-50"
        >
          <IconHandStop className="size-3.5" strokeWidth={1.75} />
          Poke back
        </button>
      )}
      {section === "matched" && (
        <MatchDiscordButton
          card={card}
          compact
          className="h-10 shrink-0 px-4"
        />
      )}
      {section === "sent" && (
        <span className="shrink-0 text-xs font-light text-ink/55">Waiting</span>
      )}
    </li>
  );
});

export function PokesView() {
  const pokes = useDirectoryStore((s) => s.pokes);
  const sentPokes = useDirectoryStore((s) => s.sentPokes);
  const pokesLoading = useDirectoryStore((s) => s.pokesLoading);
  const busy = useDirectoryStore((s) => s.busy);
  const fetchPokes = useDirectoryStore((s) => s.fetchPokes);
  const markPokesSeen = useDirectoryStore((s) => s.markPokesSeen);
  const poke = useDirectoryStore((s) => s.poke);
  const toggleContact = useDirectoryStore((s) => s.toggleContact);
  const [openId, setOpenId] = useState<string | null>(null);

  // Seeing the list clears the unseen badge, through the newest poke shown.
  useEffect(() => {
    const controller = new AbortController();
    void fetchPokes(controller.signal).then(() => {
      if (!controller.signal.aborted) void markPokesSeen();
    });
    return () => controller.abort();
  }, [fetchPokes, markPokesSeen]);

  if (pokesLoading && pokes.length === 0 && sentPokes.length === 0) {
    return (
      <p className="py-16 text-center text-sm font-light text-ink/65">
        Loading...
      </p>
    );
  }
  if (pokes.length === 0 && sentPokes.length === 0) {
    return (
      <p className="py-16 text-center text-sm font-light text-ink/65">
        No pokes yet. Poke people in{" "}
        <Link to="/app/directory" className="text-ink underline">
          the Directory
        </Link>
        , and anyone who pokes you shows up here.
      </p>
    );
  }

  const groups = groupPokes(pokes, sentPokes);
  // Read from the lists so a poke back in the dialog shows right away.
  const open =
    pokes.find((c) => c.user_id === openId) ??
    sentPokes.find((c) => c.user_id === openId) ??
    null;

  return (
    <>
      <div className="mt-5 flex max-w-3xl flex-col gap-7">
        {SECTIONS.map(({ id, title, hint }) => {
          const cards = groups[id];
          if (cards.length === 0) return null;
          return (
            <section key={id} aria-labelledby={`pokes-${id}`}>
              <h2 id={`pokes-${id}`} className="text-sm font-medium text-ink">
                {title} <span className="tabular-nums">· {cards.length}</span>
              </h2>
              <p className="mt-1 mb-2.5 text-xs font-light text-ink/55">
                {hint}
              </p>
              <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-surface">
                {cards.map((card) => (
                  <PokeRow
                    key={card.user_id}
                    card={card}
                    section={id}
                    busy={busy[card.user_id]}
                    onOpen={setOpenId}
                    onPoke={poke}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <CardDialog
        card={open}
        busy={open ? busy[open.user_id] : false}
        onClose={() => setOpenId(null)}
        onPoke={poke}
        onToggleContact={toggleContact}
      />
    </>
  );
}
