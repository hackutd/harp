import {
  IconAddressBook,
  IconUsers,
  type TablerIcon,
} from "@tabler/icons-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FEATURES: { icon: TablerIcon; title: string; body: string }[] = [
  {
    icon: IconUsers,
    title: "Directory",
    body: "Browse everyone else who's coming, poke people, and find teammates.",
  },
  {
    icon: IconAddressBook,
    title: "My contacts",
    body: "Save the people you meet and swap Discord in one tap.",
  },
];

interface DirectoryUnlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Shown right after a hacker confirms their RSVP: the directory pages only
// appear in the nav from that point on, so call them out instead of letting
// them show up unannounced.
export function DirectoryUnlockedDialog({
  open,
  onOpenChange,
}: DirectoryUnlockedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-sm flex-col gap-5 rounded-xl p-6 sm:max-w-sm">
        <DialogHeader>
          <p className="text-[11px] font-medium tracking-[0.2em] text-ice uppercase">
            Unlocked
          </p>
          <DialogTitle className="text-xl font-light tracking-tight">
            You're in. Meet who's coming.
          </DialogTitle>
          <DialogDescription>
            Confirming your spot opened up two new pages in your menu.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink">
                <Icon className="size-4.5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-0.5 block text-xs font-light text-ink/65">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <Button asChild className="w-full rounded-full">
            <Link to="/app/profile?edit=1" onClick={() => onOpenChange(false)}>
              Finish my profile
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
