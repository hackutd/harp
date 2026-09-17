import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/lib/utils";

import { DEFAULT_SCHEDULE_TAGS } from "../../constants";
import { TAG_COLOR_STYLES } from "../../styles";

type ScheduleTagPickerProps = {
  selectedTag: string;
  isOtherTagSelected: boolean;
  otherTagValue: string;
  onPresetTagSelect: (tag: (typeof DEFAULT_SCHEDULE_TAGS)[number]) => void;
  onOtherTagToggle: () => void;
  onOtherTagValueChange: (value: string) => void;
};

export function ScheduleTagPicker({
  selectedTag,
  isOtherTagSelected,
  otherTagValue,
  onPresetTagSelect,
  onOtherTagToggle,
  onOtherTagValueChange,
}: ScheduleTagPickerProps) {
  return (
    <div className="space-y-1.5">
      <Label>Tag</Label>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_SCHEDULE_TAGS.map((tag) => {
          const isSelected = !isOtherTagSelected && selectedTag === tag;
          return (
            <Badge
              key={tag}
              asChild
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-opacity",
                isSelected
                  ? TAG_COLOR_STYLES[tag]
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
              )}
            >
              <button type="button" onClick={() => onPresetTagSelect(tag)}>
                {tag}
              </button>
            </Badge>
          );
        })}
        <Badge
          asChild
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-opacity",
            isOtherTagSelected
              ? TAG_COLOR_STYLES.Other
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
          )}
        >
          <button type="button" onClick={onOtherTagToggle}>
            Other
          </button>
        </Badge>
      </div>
      {isOtherTagSelected ? (
        <Input
          value={otherTagValue}
          onChange={(event) => onOtherTagValueChange(event.target.value)}
          placeholder="Enter custom tag"
        />
      ) : null}
    </div>
  );
}
