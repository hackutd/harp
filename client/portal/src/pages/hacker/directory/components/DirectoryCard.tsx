import {
  IconArrowBackUp,
  IconBookmark,
  IconBookmarkFilled,
  IconBriefcase,
  IconCopy,
  IconEyeOff,
  IconHandStop,
  IconRosetteDiscountCheck,
  IconSparkles,
} from "@tabler/icons-react";
import { memo, type ReactNode, useState } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { GitHubIcon, LinkedInIcon } from "@/shared/lib/hacker-link-brand-icons";
import { cn } from "@/shared/lib/utils";

import type { DirectoryCardData } from "../types";
import {
  CHIP_BLUE,
  copyDiscordUsername,
  githubURL,
  initials,
  intentLabel,
  linkedInURL,
  roleLabel,
} from "../utils";

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
  // Shows everything on the card itself rather than in the hover card, for
  // the one-at-a-time review and a contact opened from the list.
  detailed?: boolean;
  // With detailed, puts the details beside the photo from md up so an opened
  // card stays short; phones keep the stacked polaroid.
  sideBySide?: boolean;
  className?: string;
}

interface ChipProps {
  children: ReactNode;
  className?: string;
}

export function Chip({ children, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface MatchDiscordButtonProps {
  card: DirectoryCardData;
  /** Short label for the card's action row; the full one stays accessible. */
  compact?: boolean;
  className?: string;
}

const discordButtonClass =
  "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-tide px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-tide-hover";

export function MatchDiscordButton({
  card,
  compact,
  className,
}: MatchDiscordButtonProps) {
  if (!card.matched) return null;
  if (!card.discord_username) {
    return (
      <span
        className={cn(
          "inline-flex items-center text-xs font-light text-ink/55",
          className,
        )}
      >
        {compact ? "No Discord yet" : "No Discord on file yet"}
      </span>
    );
  }
  const username = card.discord_username;
  return (
    <button
      type="button"
      onClick={() => void copyDiscordUsername(username)}
      aria-label={compact ? `Copy Discord: ${username}` : undefined}
      className={cn(discordButtonClass, className)}
    >
      <IconCopy className="size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">
        {compact ? "Discord" : `Copy Discord: ${username}`}
      </span>
    </button>
  );
}

interface ProfileLinksProps {
  card: Pick<DirectoryCardData, "github_username" | "linkedin_handle">;
}

const profileLinkClass =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink/75 transition-colors hover:text-ink";

export function ProfileLinks({ card }: ProfileLinksProps) {
  if (!card.github_username && !card.linkedin_handle) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {card.github_username && (
        <a
          href={githubURL(card.github_username)}
          target="_blank"
          rel="noopener noreferrer"
          className={profileLinkClass}
        >
          <GitHubIcon className="size-3.5" />
          {card.github_username}
        </a>
      )}
      {card.linkedin_handle && (
        <a
          href={linkedInURL(card.linkedin_handle)}
          target="_blank"
          rel="noopener noreferrer"
          className={profileLinkClass}
        >
          <LinkedInIcon className="size-3.5" />
          LinkedIn
        </a>
      )}
    </div>
  );
}

interface CardDetailsProps {
  card: DirectoryCardData;
  /** The directory card shows the icebreaker as its caption instead. */
  hideIcebreaker?: boolean;
}

// Everything on a card below the name and status: shared by the directory
// card and the hacker's own Profile page, so both always show the same thing.
export function CardDetails({ card, hideIcebreaker }: CardDetailsProps) {
  return (
    <>
      {card.experiences.length > 0 && (
        <ul className="mt-3 space-y-1">
          {card.experiences.map((e) => (
            <li
              key={`${e.company}-${e.title}`}
              className="flex items-start gap-2 text-sm font-light text-ink/85"
            >
              <IconBriefcase
                className="mt-0.5 size-3.5 shrink-0 text-ink/55"
                strokeWidth={1.75}
              />
              <span className="min-w-0">
                {e.title}
                <span className="text-ink/55"> at </span>
                {e.company}
              </span>
            </li>
          ))}
        </ul>
      )}

      {card.want_to_build && (
        <p className="mt-3 text-sm font-light text-ink/85">
          <span className="text-ink/55">Wants to build </span>
          {card.want_to_build}
        </p>
      )}

      {!hideIcebreaker && card.icebreaker_prompt && card.icebreaker_answer && (
        <div className="mt-3 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2">
          <p className="text-xs font-medium text-ice">
            {card.icebreaker_prompt}
          </p>
          <p className="mt-0.5 text-sm font-light text-ink/85">
            {card.icebreaker_answer}
          </p>
        </div>
      )}

      {(card.skills.length > 0 || card.interest_tags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.skills.map((s) => (
            <Chip key={`s-${s}`} className="text-ink/85">
              {s}
            </Chip>
          ))}
          {card.interest_tags.map((t) => (
            <Chip key={`t-${t}`} className={CHIP_BLUE}>
              {t}
            </Chip>
          ))}
        </div>
      )}

      {card.roles_looking_for.length > 0 && (
        <p className="mt-3 text-xs font-light text-ink/65">
          Looking for: {card.roles_looking_for.map(roleLabel).join(", ")}
        </p>
      )}

      {(card.github_username || card.linkedin_handle) && (
        <div className="mt-3">
          <ProfileLinks card={card} />
        </div>
      )}

      {card.stale && (
        <p className="mt-2 text-[11px] font-light text-ink/55">
          Status not updated recently
        </p>
      )}
    </>
  );
}

interface IcebreakerProps {
  card: DirectoryCardData;
  /** The small card: the quote is clamped to two lines, without its prompt. */
  compact?: boolean;
  className?: string;
}

function Icebreaker({ card, compact, className }: IcebreakerProps) {
  if (!card.icebreaker_answer) return null;
  return (
    <div className={cn(compact ? "mt-1.5" : "mt-2", className)}>
      {!compact && card.icebreaker_prompt && (
        <p className="text-[11px] font-light text-ink/50">
          {card.icebreaker_prompt}
        </p>
      )}
      <p
        className={cn(
          "leading-snug font-light text-ink/70 italic",
          compact ? "line-clamp-2 text-[11px]" : "text-xs",
        )}
      >
        &ldquo;{card.icebreaker_answer}&rdquo;
      </p>
    </div>
  );
}

interface CardCaptionProps {
  card: DirectoryCardData;
  /** The small card: the quote is clamped to two lines, without its prompt. */
  compact?: boolean;
  /** Extra classes for the icebreaker, e.g. to hide it where it moves. */
  icebreakerClassName?: string;
}

// The writing under the photo: name, status, and the icebreaker as a quote.
function CardCaption({ card, compact, icebreakerClassName }: CardCaptionProps) {
  const looking =
    card.intent === "looking_for_teammates" || card.intent === "partial_team";
  return (
    <>
      <div className="flex items-center gap-1">
        <h3
          className={cn(
            "min-w-0 truncate font-medium tracking-tight",
            compact ? "text-sm" : "text-[15px]",
          )}
        >
          {card.display_name}
        </h3>
        {card.checked_in && (
          <IconRosetteDiscountCheck
            aria-label="Checked in"
            className="size-3.5 shrink-0 text-ink"
            strokeWidth={2}
          />
        )}
        {card.pronouns && (
          <span className="shrink-0 truncate text-[11px] font-light text-ink/55">
            {card.pronouns}
          </span>
        )}
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-ink/55 uppercase">
        {looking && (
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-tide"
          />
        )}
        <span className="truncate">
          {intentLabel(card.intent, card.spots_needed)}
        </span>
      </p>
      <Icebreaker
        card={card}
        compact={compact}
        className={icebreakerClassName}
      />
    </>
  );
}

interface CardBackProps {
  card: DirectoryCardData;
  icebreakerClassName?: string;
}

// Everything that doesn't fit on the small card, shown when it's hovered or
// tapped: the back of the postcard.
function CardBack({ card, icebreakerClassName }: CardBackProps) {
  const hasDetails =
    card.experiences.length > 0 ||
    card.want_to_build ||
    card.skills.length > 0 ||
    card.interest_tags.length > 0 ||
    card.roles_looking_for.length > 0 ||
    card.github_username ||
    card.linkedin_handle;
  return (
    <>
      <CardCaption card={card} icebreakerClassName={icebreakerClassName} />
      {hasDetails ? (
        <CardDetails card={card} hideIcebreaker />
      ) : (
        <p className="mt-3 text-xs font-light text-ink/55">
          Nothing else here yet.
        </p>
      )}
    </>
  );
}

// Memoized so a busy flag or poke on one card doesn't re-render the whole grid.
export const DirectoryCard = memo(function DirectoryCard({
  card,
  busy,
  hideActions,
  detailed,
  sideBySide,
  className,
  onPoke,
  onToggleContact,
  onHide,
  onUnhide,
}: DirectoryCardProps) {
  const [open, setOpen] = useState(false);
  const pokeLabel = card.poked_by_me
    ? "Poke sent"
    : card.poked_me
      ? "Poke back"
      : "Poke";

  const photo = (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-surface-2",
        detailed ? "aspect-[4/5]" : "aspect-square",
      )}
    >
      {card.headshot_url ? (
        <img
          src={card.headshot_url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-3xl font-light text-ink/40">
          {initials(card.display_name)}
        </span>
      )}
      {(card.matched || card.poked_me) && (
        <div className="absolute top-1.5 left-1.5">
          {card.matched ? (
            <Chip className={cn(CHIP_BLUE, "px-2 text-[10px]")}>
              <IconSparkles className="mr-1 size-3" /> Match
            </Chip>
          ) : (
            <Chip className={cn(CHIP_BLUE, "px-2 text-[10px]")}>Poked you</Chip>
          )}
        </div>
      )}
    </div>
  );

  // The grid card's action row is a size down from the detailed card's.
  const buttonHeight = detailed ? "h-8" : "h-7";
  const iconButton = cn(
    "inline-flex shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
    detailed ? "size-8" : "size-7",
  );
  const iconSize = detailed ? "size-4" : "size-3.5";

  const actions = !hideActions && (
    <div
      className={cn(
        "mt-auto flex items-center gap-1.5",
        detailed ? "pt-3" : "pt-2",
      )}
    >
      {card.is_hidden ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onUnhide?.(card)}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/15 px-3 text-xs font-medium text-ink/85 transition-colors hover:bg-ink/[0.04] disabled:opacity-50",
            buttonHeight,
          )}
        >
          <IconArrowBackUp className="size-3.5" /> Unhide
        </button>
      ) : (
        <>
          {card.matched ? (
            <MatchDiscordButton
              card={card}
              compact
              className={cn(buttonHeight, "flex-1 px-2.5")}
            />
          ) : (
            <button
              type="button"
              disabled={busy || card.poked_by_me}
              onClick={() => onPoke?.(card)}
              className={cn(
                "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-tide px-2.5 text-xs font-medium text-white transition-colors hover:bg-tide-hover disabled:bg-ink/[0.06] disabled:text-ink/45",
                buttonHeight,
              )}
            >
              <IconHandStop className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{pokeLabel}</span>
            </button>
          )}
          {onToggleContact && (
            <button
              type="button"
              disabled={busy}
              aria-pressed={card.is_contact}
              aria-label={
                card.is_contact ? "Remove from contacts" : "Add to contacts"
              }
              title={
                card.is_contact ? "Remove from contacts" : "Add to contacts"
              }
              onClick={() => onToggleContact(card)}
              className={cn(
                iconButton,
                card.is_contact
                  ? "border-ice/50 bg-ice/10 text-ice"
                  : "border-ink/15 text-ink/75 hover:bg-ink/[0.04]",
              )}
            >
              {card.is_contact ? (
                <IconBookmarkFilled className={iconSize} strokeWidth={1.75} />
              ) : (
                <IconBookmark className={iconSize} strokeWidth={1.75} />
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
              className={cn(
                iconButton,
                "border-ink/15 text-ink/65 hover:bg-ink/[0.04]",
              )}
            >
              <IconEyeOff className={iconSize} strokeWidth={1.75} />
            </button>
          )}
        </>
      )}
    </div>
  );

  // A printed photo, like a polaroid: the picture on top, a caption below.
  const shell = cn(
    "directory-postcard flex h-full flex-col rounded-[3px] p-2",
    card.stale && "opacity-80",
    className,
  );

  if (detailed) {
    return (
      <article
        data-testid="directory-card"
        className={cn(shell, "p-3 pb-4", sideBySide && "md:flex-row md:gap-5")}
      >
        {sideBySide ? (
          // Desktop moves the icebreaker under the photo to even out the
          // two columns; phones keep it under the name.
          <div className="shrink-0 md:w-60 md:self-start">
            {photo}
            <Icebreaker card={card} className="hidden px-1 md:mt-3 md:block" />
          </div>
        ) : (
          photo
        )}
        <div
          className={cn(
            "flex flex-1 flex-col px-1 pt-3",
            sideBySide && "md:min-w-0 md:pt-1",
          )}
        >
          <CardBack
            card={card}
            icebreakerClassName={sideBySide ? "md:hidden" : undefined}
          />
          {card.matched && (
            <div className="mt-3">
              <MatchDiscordButton card={card} />
            </div>
          )}
          {actions}
        </div>
      </article>
    );
  }

  return (
    <article data-testid="directory-card" className={shell}>
      <HoverCard
        open={open}
        onOpenChange={setOpen}
        openDelay={250}
        closeDelay={120}
      >
        <HoverCardTrigger asChild>
          {/* Hover on desktop; a tap opens it on touch, where there is no
              hover. A tap outside closes it. */}
          <div
            role="button"
            tabIndex={0}
            aria-label={`More about ${card.display_name}`}
            aria-expanded={open}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((o) => !o);
              }
            }}
            className="cursor-pointer rounded-[2px] focus-visible:ring-2 focus-visible:ring-ice/50 focus-visible:outline-none"
          >
            {photo}
            <div className="px-0.5 pt-2">
              <CardCaption card={card} compact />
            </div>
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          collisionPadding={12}
          className="directory-postcard max-h-[min(28rem,var(--radix-hover-card-content-available-height))] w-72 overflow-y-auto rounded-[3px] border-0 p-4"
        >
          <CardBack card={card} />
        </HoverCardContent>
      </HoverCard>
      <div className="flex flex-1 flex-col px-0.5">{actions}</div>
    </article>
  );
});
