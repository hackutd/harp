import { Minus, ThumbsDown, ThumbsUp } from "lucide-react";

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
  label?: string;
}

export function GradingActionButtons({
  disabled,
  onReject,
  onWaitlist,
  onAccept,
  label = "Cast your vote",
}: GradingActionButtonsProps) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-col gap-2 mt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onReject}
              loading={disabled}
            >
              <ThumbsDown className="h-4 w-4 mr-1.5" />
              Reject
              <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                ⌘J
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reject (⌘J)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onWaitlist}
              loading={disabled}
            >
              <Minus className="h-4 w-4 mr-1.5" />
              Waitlist
              <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Waitlist (⌘K)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onAccept}
              loading={disabled}
            >
              <ThumbsUp className="h-4 w-4 mr-1.5" />
              Accept
              <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                ⌘L
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Accept (⌘L)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
