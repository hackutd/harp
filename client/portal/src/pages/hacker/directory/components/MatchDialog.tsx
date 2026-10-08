import { IconBrandDiscord, IconCopy } from "@tabler/icons-react";
import { type ReactNode, useEffect } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitHubIcon, LinkedInIcon } from "@/shared/lib/hacker-link-brand-icons";
import { cn } from "@/shared/lib/utils";

import { useDirectoryStore } from "../store";
import type { DirectoryCardData } from "../types";
import {
  copyDiscordUsername,
  githubURL,
  initials,
  linkedInURL,
} from "../utils";

// canvas-confetti needs literal hex: tide, ice and white from index.css.
const CONFETTI_COLORS = ["#086C88", "#D6F9FF", "#FFFFFF"];

async function fireConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 70,
    spread: 90,
    origin: { x: 0.5, y: 0.3 },
    startVelocity: 32,
    gravity: 0.7,
    scalar: 0.9,
    shapes: ["square", "circle"],
    colors: CONFETTI_COLORS,
  });
}

const rowClass =
  "flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm font-light text-ink";

interface ContactRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
}

function ContactRow({ icon, label, value, href }: ContactRowProps) {
  const body = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-ink/55">{label}</span>
        <span className="block truncate">{value}</span>
      </span>
    </>
  );
  return (
    <li className="flex items-center">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label}: ${value}`}
          className={cn(
            rowClass,
            "min-w-0 flex-1 transition-colors hover:bg-ink/[0.03]",
          )}
        >
          {body}
        </a>
      ) : (
        <div className={cn(rowClass, "min-w-0 flex-1")}>{body}</div>
      )}
    </li>
  );
}

function ContactList({ card }: { card: DirectoryCardData }) {
  const username = card.discord_username;
  if (!username && !card.github_username && !card.linkedin_handle) {
    return (
      <p className="rounded-xl border border-ink/10 px-4 py-3 text-center text-xs font-light text-ink/65">
        They haven't added Discord or links yet. Find them at the event!
      </p>
    );
  }
  return (
    <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
      {username && (
        <ContactRow
          icon={<IconBrandDiscord className="size-4" strokeWidth={1.75} />}
          label="Discord"
          value={username}
        />
      )}
      {card.github_username && (
        <ContactRow
          icon={<GitHubIcon className="size-4" />}
          label="GitHub"
          value={card.github_username}
          href={githubURL(card.github_username)}
        />
      )}
      {card.linkedin_handle && (
        <ContactRow
          icon={<LinkedInIcon className="size-4" />}
          label="LinkedIn"
          value={card.linkedin_handle}
          href={linkedInURL(card.linkedin_handle)}
        />
      )}
    </ul>
  );
}

// Celebrates a poke that just made a match and hands over the contact details
// it unlocked, wherever in the directory the poke happened.
export function MatchDialog() {
  const match = useDirectoryStore((s) => s.newMatch);
  const dismissMatch = useDirectoryStore((s) => s.dismissMatch);

  useEffect(() => {
    if (match) void fireConfetti();
  }, [match]);

  const firstName = match?.display_name.split(" ")[0] ?? "";
  const username = match?.discord_username ?? null;

  return (
    <Dialog
      open={match != null}
      onOpenChange={(next) => {
        if (!next) dismissMatch();
      }}
    >
      <DialogContent className="flex max-w-sm flex-col gap-5 rounded-xl p-6 sm:max-w-sm">
        {match && (
          <>
            <DialogHeader className="items-center text-center sm:text-center">
              <Avatar className="mb-2 size-20 border border-ink/10">
                {match.headshot_url && (
                  <AvatarImage
                    src={match.headshot_url}
                    alt=""
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-surface text-xl font-light text-ink">
                  {initials(match.display_name)}
                </AvatarFallback>
              </Avatar>
              <p className="text-[11px] font-medium tracking-[0.2em] text-ice uppercase">
                It's a match
              </p>
              <DialogTitle className="text-xl font-light tracking-tight">
                Congrats! You and {firstName} are connected
              </DialogTitle>
              <DialogDescription>
                You both poked, so you can see each other's Discord now. Say hi
                and see if you'd build well together.
              </DialogDescription>
            </DialogHeader>

            <ContactList card={match} />

            <div className="flex flex-col gap-2">
              {/* Always a copy, so every match gets the same step: paste it
                  into Discord's Add Friend. */}
              {username && (
                <Button
                  type="button"
                  className="h-11 w-full rounded-full bg-tide text-white hover:bg-tide-hover"
                  onClick={() => void copyDiscordUsername(username)}
                >
                  <IconCopy className="size-4" strokeWidth={1.75} />
                  Copy Discord username
                </Button>
              )}
              <Button
                type="button"
                variant={username ? "outline" : "default"}
                className={cn(
                  "h-11 w-full rounded-full",
                  username
                    ? "border-ink/15 bg-transparent text-ink hover:bg-surface-2"
                    : "bg-tide text-white hover:bg-tide-hover",
                )}
                onClick={dismissMatch}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
