import type { LucideIcon } from "lucide-react";
import { Check, Minus, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

type GradingAction = "reject" | "waitlist" | "accept";

interface GradingActionButtonsProps {
  disabled: boolean;
  onReject: () => void;
  onWaitlist: () => void;
  onAccept: () => void;
  label?: string | null;
  selected?: GradingAction | null;
  /** "row" fits the three actions side by side; shortcuts move to tooltips. */
  layout?: "stacked" | "row";
  /** A reviewer casts a vote; a super admin sets the final decision. */
  intent?: "vote" | "decision";
}

const ACTIONS: {
  key: GradingAction;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}[] = [
  { key: "reject", label: "Reject", shortcut: "⌘J", icon: ThumbsDown },
  { key: "waitlist", label: "Waitlist", shortcut: "⌘K", icon: Minus },
  { key: "accept", label: "Accept", shortcut: "⌘L", icon: ThumbsUp },
];

export function GradingActionButtons({
  disabled,
  onReject,
  onWaitlist,
  onAccept,
  label = "Cast your vote",
  selected = null,
  layout = "stacked",
  intent = "vote",
}: GradingActionButtonsProps) {
  const handlers: Record<GradingAction, () => void> = {
    reject: onReject,
    waitlist: onWaitlist,
    accept: onAccept,
  };
  const isRow = layout === "row";

  return (
    <div>
      {label && (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      )}
      <div
        className={cn(
          isRow ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2",
          label && "mt-2",
        )}
      >
        {ACTIONS.map(({ key, label: actionLabel, shortcut, icon: Icon }) => {
          const isSelected = selected === key;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  aria-pressed={isSelected}
                  className={cn(
                    "w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                    isRow && "px-2 font-normal shadow-none",
                    isSelected &&
                      (isRow
                        ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                        : "border-foreground/40 bg-accent text-accent-foreground shadow-xs"),
                  )}
                  onClick={handlers[key]}
                  loading={disabled}
                >
                  <Icon className={cn("h-4 w-4", !isRow && "mr-1.5")} />
                  {actionLabel}
                  {!isRow && (
                    <span className="ml-auto flex items-center gap-2">
                      {isSelected && (
                        <Check className="h-4 w-4" aria-label="Selected" />
                      )}
                      <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {shortcut}
                      </kbd>
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {intent === "decision" ? "Final decision" : "Your vote"} ·{" "}
                {shortcut}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
