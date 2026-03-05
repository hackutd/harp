import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

import type {
  ScheduleComposerSession,
  ScheduleComposerValues,
} from "../../types";
import { ScheduleTagPicker } from "./ScheduleTagPicker";
import { ScheduleTimeRangeFields } from "./ScheduleTimeRangeFields";

type ScheduleComposerPopoverProps = {
  open: boolean;
  session: ScheduleComposerSession;
  dayText: string;
  rangeText: string;
  creatingItem: boolean;
  deletingItem: boolean;
  onOpenChange: (open: boolean) => void;
  onStartQuarterChange: (value: string) => void;
  onEndQuarterChange: (value: string) => void;
  onSave: (values: ScheduleComposerValues) => Promise<void>;
  onDelete: () => Promise<void>;
};

export function ScheduleComposerPopover({
  open,
  session,
  dayText,
  rangeText,
  creatingItem,
  deletingItem,
  onOpenChange,
  onStartQuarterChange,
  onEndQuarterChange,
  onSave,
  onDelete,
}: ScheduleComposerPopoverProps) {
  const [values, setValues] = useState<ScheduleComposerValues>(
    session.initialValues,
  );

  const isEditing = session.mode === "edit";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div className="absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={0}
        className="w-80 space-y-3"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isEditing ? "Edit schedule item" : "Create schedule item"}
          </p>
          <p className="text-muted-foreground text-xs">
            {dayText} • {rangeText}
          </p>
        </div>

        <ScheduleTimeRangeFields
          startQuarter={session.startQuarter}
          endQuarter={session.endQuarter}
          onStartQuarterChange={onStartQuarterChange}
          onEndQuarterChange={onEndQuarterChange}
        />

        <div className="space-y-1.5">
          <Label htmlFor="schedule-item-title">Title</Label>
          <Input
            id="schedule-item-title"
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="Opening ceremony"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule-item-location">Location</Label>
          <Input
            id="schedule-item-location"
            value={values.location}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                location: event.target.value,
              }))
            }
            placeholder="Main stage"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule-item-details">Details</Label>
          <Textarea
            id="schedule-item-details"
            value={values.details}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                details: event.target.value,
              }))
            }
            placeholder="Optional details"
            rows={3}
          />
        </div>

        <ScheduleTagPicker
          selectedTag={values.tag}
          isOtherTagSelected={values.isOtherTagSelected}
          otherTagValue={values.otherTagValue}
          onPresetTagSelect={(tag) => {
            setValues((current) => ({
              ...current,
              tag,
              isOtherTagSelected: false,
              otherTagValue: "",
            }));
          }}
          onOtherTagToggle={() => {
            setValues((current) => {
              const nextIsOther = !current.isOtherTagSelected;
              if (!nextIsOther) {
                return {
                  ...current,
                  tag: "",
                  isOtherTagSelected: false,
                  otherTagValue: "",
                };
              }

              return {
                ...current,
                isOtherTagSelected: true,
                tag: current.otherTagValue.trim(),
              };
            });
          }}
          onOtherTagValueChange={(value) => {
            setValues((current) => ({
              ...current,
              otherTagValue: value,
              tag: current.isOtherTagSelected ? value.trim() : current.tag,
            }));
          }}
        />

        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              disabled={creatingItem || deletingItem}
              aria-label="Delete schedule item"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2
                className={cn("size-4", deletingItem && "animate-pulse")}
              />
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={() => onSave(values)}
            disabled={!values.title.trim() || creatingItem || deletingItem}
            className="bg-indigo-400 hover:bg-indigo-500 text-white"
          >
            {creatingItem
              ? isEditing
                ? "Updating..."
                : "Creating..."
              : isEditing
                ? "Update"
                : "Create"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
