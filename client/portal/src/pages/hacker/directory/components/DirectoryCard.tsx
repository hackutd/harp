import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Copy,
  EyeOff,
  Hand,
  MessageCircle,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";

import type { DirectoryCardData } from "../types";
import { discordLink, initials, INTENT_STYLES, intentLabel } from "../utils";

export interface DirectoryCardActions {
  onPoke?: (card: DirectoryCardData) => void;
  onToggleContact?: (card: DirectoryCardData) => void;
  onHide?: (card: DirectoryCardData) => void;
  onUnhide?: (card: DirectoryCardData) => void;
}

interface DirectoryCardProps extends DirectoryCardActions {
  card: DirectoryCardData;
  busy?: boolean;
  // Swipe mode drives poke/hide by gesture, so the action row is dropped.
  hideActions?: boolean;
  className?: string;
}

function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MatchDiscordButton({ card }: { card: DirectoryCardData }) {
  if (!card.matched) return null;
  const link = discordLink(card);
  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-[#5865F2] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4752C4]"
      >
        <MessageCircle className="size-3.5" strokeWidth={1.75} />
        Message on Discord
      </a>
    );
  }
  if (!card.discord_username) {
    return (
      <span className="text-xs font-light text-white/45">
        No Discord on file yet
      </span>
    );
  }
  const username = card.discord_username;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(username);
          toast.success(`Copied ${username}`, {
            description: "Paste it into Discord's Add Friend search.",
          });
        } catch {
          toast(username);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#5865F2] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4752C4]"
    >
      <Copy className="size-3.5" strokeWidth={1.75} />
      Copy Discord: {username}
    </button>
  );
}

export function DirectoryCard({
  card,
  busy,
  hideActions,
  className,
  onPoke,
  onToggleContact,
  onHide,
  onUnhide,
}: DirectoryCardProps) {
  const pokeLabel = card.matched
    ? "Matched"
    : card.poked_by_me
      ? "Poked"
      : card.poked_me
        ? "Poke back"
        : "Poke";

  return (
    <article
      data-testid="directory-card"
      className={cn(
        "flex h-full flex-col rounded-xl border border-white/10 bg-[#0B0C15]/92 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_14px_34px_rgba(0,0,0,0.30)]",
        card.matched && "border-[#21FFF0]/35",
        card.stale && "opacity-80",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#5900FF]/25">
          {card.headshot_url ? (
            <img
              src={card.headshot_url}
              alt=""
              className="size-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex size-full items-center justify-center text-base font-medium text-[#D8C5FF]">
              {initials(card.display_name)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-medium">
              {card.display_name}
            </h3>
            {card.checked_in && (
              <BadgeCheck
                aria-label="Checked in"
                className="size-4 shrink-0 text-[#21FFF0]"
                strokeWidth={2}
              />
            )}
          </div>
          {card.pronouns && (
            <p className="text-xs font-light text-white/50">{card.pronouns}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip className={INTENT_STYLES[card.intent]}>
              {intentLabel(card.intent, card.spots_needed)}
            </Chip>
            {card.checked_in && (
              <Chip className="border-[#21FFF0]/25 bg-[#21FFF0]/5 text-[#21FFF0]/85">
                Checked in
              </Chip>
            )}
            {card.poked_me && !card.matched && (
              <Chip className="border-[#F62BE8]/35 bg-[#F62BE8]/10 text-[#FF8FF7]">
                Poked you
              </Chip>
            )}
            {card.matched && (
              <Chip className="border-[#21FFF0]/40 bg-[#21FFF0]/15 text-[#21FFF0]">
                <Sparkles className="mr-1 size-3" /> Match
              </Chip>
            )}
          </div>
        </div>
      </header>

      {card.want_to_build && (
        <p className="mt-3 text-sm font-light text-white/80">
          <span className="text-white/45">Wants to build </span>
          {card.want_to_build}
        </p>
      )}

      {card.icebreaker_prompt && card.icebreaker_answer && (
        <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
          <p className="text-[11px] font-medium tracking-wide text-[#F62BE8]/85 uppercase">
            {card.icebreaker_prompt}
          </p>
          <p className="mt-0.5 text-sm font-light text-white/85">
            {card.icebreaker_answer}
          </p>
        </div>
      )}

      {(card.skills.length > 0 || card.interest_tags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.skills.map((s) => (
            <Chip key={`s-${s}`} className="border-white/15 text-white/80">
              {s}
            </Chip>
          ))}
          {card.interest_tags.map((t) => (
            <Chip
              key={`t-${t}`}
              className="border-[#A857FF]/30 bg-[#5900FF]/15 text-[#D8C5FF]"
            >
              {t}
            </Chip>
          ))}
        </div>
      )}

      {card.roles_looking_for.length > 0 && (
        <p className="mt-3 text-xs font-light text-white/55">
          Looking for: {card.roles_looking_for.join(", ")}
        </p>
      )}

      {card.stale && (
        <p className="mt-2 text-[11px] font-light text-white/40">
          Status not updated recently
        </p>
      )}

      <div className="mt-auto pt-4">
        {card.matched && (
          <div className="mb-3">
            <MatchDiscordButton card={card} />
          </div>
        )}
        {!hideActions && (
          <div className="flex items-center gap-2">
            {card.is_hidden ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onUnhide?.(card)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                <Undo2 className="size-3.5" /> Unhide
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || card.poked_by_me}
                  onClick={() => onPoke?.(card)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#5900FF] px-3.5 py-1.5 text-xs font-medium text-white shadow-[0_0_16px_rgba(89,0,255,0.25)] transition-colors hover:bg-[#6D1CFF] disabled:bg-[#5900FF]/30 disabled:text-white/60 disabled:shadow-none"
                >
                  <Hand className="size-3.5" strokeWidth={1.75} />
                  {pokeLabel}
                </button>
                {onToggleContact && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={card.is_contact}
                    aria-label={
                      card.is_contact
                        ? "Remove from contacts"
                        : "Add to contacts"
                    }
                    title={
                      card.is_contact
                        ? "Remove from contacts"
                        : "Add to contacts"
                    }
                    onClick={() => onToggleContact(card)}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
                      card.is_contact
                        ? "border-[#21FFF0]/40 bg-[#21FFF0]/10 text-[#21FFF0]"
                        : "border-white/15 text-white/70 hover:bg-white/5",
                    )}
                  >
                    {card.is_contact ? (
                      <BookmarkCheck className="size-4" strokeWidth={1.75} />
                    ) : (
                      <Bookmark className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                )}
                {onHide && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="Hide"
                    title="Hide"
                    onClick={() => onHide(card)}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <EyeOff className="size-4" strokeWidth={1.75} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
