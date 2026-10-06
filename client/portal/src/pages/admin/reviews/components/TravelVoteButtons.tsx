import { ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SELECTED_BUTTON } from "@/pages/admin/_shared/grading";
import { cn } from "@/shared/lib/utils";

interface TravelVoteButtonsProps {
  value: boolean | null;
  disabled: boolean;
  onChange: (vote: boolean) => void;
}

const OPTIONS = [
  { vote: false, label: "No", icon: ThumbsDown },
  { vote: true, label: "Yes", icon: ThumbsUp },
] as const;

export function TravelVoteButtons({
  value,
  disabled,
  onChange,
}: TravelVoteButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map(({ vote, label, icon: Icon }) => (
        <Button
          key={label}
          variant="outline"
          aria-pressed={value === vote}
          className={cn(
            "w-full cursor-pointer font-normal shadow-none disabled:cursor-not-allowed",
            value === vote && SELECTED_BUTTON,
          )}
          disabled={disabled}
          onClick={() => onChange(vote)}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
