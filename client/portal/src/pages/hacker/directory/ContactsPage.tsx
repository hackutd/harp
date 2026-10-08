import { IconCopy, IconMessageCircle, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GitHubIcon, LinkedInIcon } from "@/shared/lib/hacker-link-brand-icons";
import { cn } from "@/shared/lib/utils";

import { CardDialog } from "./components/CardDialog";
import { useDirectoryStore } from "./store";
import type { DirectoryCardData } from "./types";
import {
  copyDiscordUsername,
  githubURL,
  initials,
  intentLabel,
  linkedInURL,
  openOnRowClick,
} from "./utils";

// Name, status, Discord, links, actions. On phones
// everything but the actions folds into the name cell.
const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1.4fr)_9.5rem_minmax(0,1fr)_4.5rem_7.5rem]";

const iconButton =
  "flex size-8 shrink-0 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50";

function relation(card: DirectoryCardData): string {
  if (card.matched) return "Matched";
  if (card.poked_me) return "Poked you";
  if (card.poked_by_me) return "You poked";
  return "Saved";
}

interface CardProps {
  card: DirectoryCardData;
}

function ContactLinks({ card }: CardProps) {
  if (!card.github_username && !card.linkedin_handle) {
    return <span className="text-sm font-light text-ink/65">—</span>;
  }
  return (
    <div className="flex items-center">
      {card.github_username && (
        <a
          href={githubURL(card.github_username)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${card.display_name} on GitHub`}
          className={iconButton}
        >
          <GitHubIcon className="size-4" />
        </a>
      )}
      {card.linkedin_handle && (
        <a
          href={linkedInURL(card.linkedin_handle)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${card.display_name} on LinkedIn`}
          className={iconButton}
        >
          <LinkedInIcon className="size-4" />
        </a>
      )}
    </div>
  );
}

// Discord is only shared between matches: the username from their RSVP,
// copied for Discord's Add Friend search.
function DiscordCell({ card }: CardProps) {
  const username = card.discord_username;
  if (!card.matched) {
    return (
      <span className="truncate text-sm font-light text-ink/65">
        Match to see
      </span>
    );
  }
  if (!username) {
    return (
      <span className="truncate text-sm font-light text-ink/65">Not added</span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-light text-ink">
        <IconMessageCircle className="size-3.5 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{username}</span>
      </span>
      <button
        type="button"
        aria-label={`Copy Discord username ${username}`}
        title="Copy username"
        onClick={() => void copyDiscordUsername(username)}
        className={iconButton}
      >
        <IconCopy className="size-3.5" strokeWidth={1.5} />
      </button>
    </span>
  );
}

interface ContactRowProps {
  card: DirectoryCardData;
  busy?: boolean;
  onOpen: (card: DirectoryCardData) => void;
  onPoke: (card: DirectoryCardData) => void;
  onRemove: (card: DirectoryCardData) => void;
}

function ContactRow({ card, busy, onOpen, onPoke, onRemove }: ContactRowProps) {
  const status = intentLabel(card.intent, card.spots_needed);
  const experience = card.experiences[0];
  return (
    <li
      onClick={openOnRowClick(() => onOpen(card))}
      className={cn(
        COLUMNS,
        "cursor-pointer px-4 py-3 transition-colors hover:bg-ink/[0.03] md:px-5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10 shrink-0 border border-ink/10">
          {card.headshot_url && (
            <AvatarImage
              src={card.headshot_url}
              alt=""
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-surface text-sm font-light text-ink">
            {initials(card.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(card)}
            aria-label={`View ${card.display_name}'s profile`}
            className="block max-w-full truncate text-left text-sm font-normal text-ink"
          >
            {card.display_name}
            {card.pronouns && (
              <span className="ml-1.5 text-xs font-light text-ink/65">
                {card.pronouns}
              </span>
            )}
          </button>
          <p className="truncate text-xs font-light text-ink/65">
            <span className="md:hidden">{status} · </span>
            {relation(card)}
            {experience && (
              <span className="hidden md:inline">
                {" "}
                · {experience.title} at {experience.company}
              </span>
            )}
          </p>
          {/* Phones have no Discord column, so a match's username sits here. */}
          {card.matched && card.discord_username && (
            <div className="mt-0.5 md:hidden">
              <DiscordCell card={card} />
            </div>
          )}
        </div>
      </div>

      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm font-light text-ink">{status}</p>
        {card.checked_in && (
          <p className="text-xs font-light text-ink/65">Checked in</p>
        )}
      </div>
      <div className="hidden min-w-0 md:block">
        <DiscordCell card={card} />
      </div>
      <div className="hidden md:block">
        <ContactLinks card={card} />
      </div>

      <div className="flex items-center justify-end gap-1">
        {!card.matched && !card.poked_by_me && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onPoke(card)}
            className="rounded-full border border-ink/10 px-3 py-1 text-xs font-light text-ink transition-colors hover:border-ink/30 disabled:opacity-50"
          >
            {card.poked_me ? "Poke back" : "Poke"}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          aria-label={`Remove ${card.display_name} from contacts`}
          title="Remove from contacts"
          onClick={() => onRemove(card)}
          className={iconButton}
        >
          <IconX className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    </li>
  );
}

export default function ContactsPage() {
  const contacts = useDirectoryStore((s) => s.contacts);
  const loading = useDirectoryStore((s) => s.contactsLoading);
  const busy = useDirectoryStore((s) => s.busy);
  const fetchContacts = useDirectoryStore((s) => s.fetchContacts);
  const poke = useDirectoryStore((s) => s.poke);
  const toggleContact = useDirectoryStore((s) => s.toggleContact);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchContacts(controller.signal);
    return () => controller.abort();
  }, [fetchContacts]);

  if (loading && contacts.length === 0) {
    return (
      <p className="py-16 text-center text-sm font-light text-ink/65">
        Loading...
      </p>
    );
  }
  if (contacts.length === 0) {
    return (
      <p className="py-16 text-center text-sm font-light text-ink/65">
        No contacts yet. Save or poke people in{" "}
        <Link to="/app/directory" className="text-ink underline">
          the Directory
        </Link>{" "}
        and they'll show up here.
      </p>
    );
  }

  const matched = contacts.filter((c) => c.matched).length;
  // Read from the list so a poke or removal in the dialog shows right away.
  const open = contacts.find((c) => c.user_id === openId) ?? null;

  return (
    <>
      <p className="mt-5 mb-2 text-xs font-light text-ink/65">
        {contacts.length} saved
        {matched > 0 && ` · ${matched} matched`} · Only you can see this list
      </p>
      <div className="overflow-hidden rounded-xl border border-ink/10">
        <div
          className={cn(
            COLUMNS,
            "hidden border-b border-ink/10 px-5 py-2.5 text-xs font-light tracking-widest text-ink/65 uppercase md:grid",
          )}
        >
          <span>Name</span>
          <span>Status</span>
          <span>Discord</span>
          <span>Links</span>
          <span />
        </div>
        <ul className="divide-y divide-ink/10">
          {contacts.map((card) => (
            <ContactRow
              key={card.user_id}
              card={card}
              busy={busy[card.user_id]}
              onOpen={(c) => setOpenId(c.user_id)}
              onPoke={poke}
              onRemove={toggleContact}
            />
          ))}
        </ul>
      </div>

      <CardDialog card={open} onClose={() => setOpenId(null)} />
    </>
  );
}
