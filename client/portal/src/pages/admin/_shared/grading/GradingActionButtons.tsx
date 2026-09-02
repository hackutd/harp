import { Check, Minus, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GradingActionButtonsProps {
  disabled: boolean;
  onReject: () => void;
  onWaitlist: () => void;
  onAccept: () => void;
  label?: string | null;
  selected?: "reject" | "waitlist" | "accept" | null;
}

export function GradingActionButtons({
  disabled,
  onReject,
  onWaitlist,
  onAccept,
  label = "Cast your vote",
  selected = null,
}: GradingActionButtonsProps) {
  return (
    <div>
      {label && (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      )}
      <div className={`flex flex-col gap-2 ${label ? "mt-2" : ""}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              aria-pressed={selected === "reject"}
              className={`w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                selected === "reject"
                  ? "border-foreground/40 bg-accent text-accent-foreground shadow-xs"
                  : ""
              }`}
              onClick={onReject}
              loading={disabled}
            >
              <ThumbsDown className="h-4 w-4 mr-1.5" />
              Reject
              <span className="ml-auto flex items-center gap-2">
                {selected === "reject" && (
                  <Check className="h-4 w-4" aria-label="Selected" />
                )}
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘J
                </kbd>
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reject (⌘J)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              aria-pressed={selected === "waitlist"}
              className={`w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                selected === "waitlist"
                  ? "border-foreground/40 bg-accent text-accent-foreground shadow-xs"
                  : ""
              }`}
              onClick={onWaitlist}
              loading={disabled}
            >
              <Minus className="h-4 w-4 mr-1.5" />
              Waitlist
              <span className="ml-auto flex items-center gap-2">
                {selected === "waitlist" && (
                  <Check className="h-4 w-4" aria-label="Selected" />
                )}
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Waitlist (⌘K)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              aria-pressed={selected === "accept"}
              className={`w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                selected === "accept"
                  ? "border-foreground/40 bg-accent text-accent-foreground shadow-xs"
                  : ""
              }`}
              onClick={onAccept}
              loading={disabled}
            >
              <ThumbsUp className="h-4 w-4 mr-1.5" />
              Accept
              <span className="ml-auto flex items-center gap-2">
                {selected === "accept" && (
                  <Check className="h-4 w-4" aria-label="Selected" />
                )}
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘L
                </kbd>
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Accept (⌘L)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
