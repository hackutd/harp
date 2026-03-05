import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { QUARTER_HOUR_SLOTS } from "../../constants";
import { formatQuarterTime } from "../../utils";

type ScheduleTimeRangeFieldsProps = {
  startQuarter: number;
  endQuarter: number;
  onStartQuarterChange: (value: string) => void;
  onEndQuarterChange: (value: string) => void;
};

export function ScheduleTimeRangeFields({
  startQuarter,
  endQuarter,
  onStartQuarterChange,
  onEndQuarterChange,
}: ScheduleTimeRangeFieldsProps) {
  return (
    <div className="space-y-1.5">
      <Label>Time range</Label>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={String(startQuarter)}
          onValueChange={onStartQuarterChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            className="!max-h-40 overflow-y-auto data-[side=bottom]:translate-y-0"
            position="popper"
            showScrollButtons={false}
            matchTriggerHeight={false}
            side="bottom"
            align="start"
            sideOffset={0}
          >
            {Array.from(
              { length: QUARTER_HOUR_SLOTS },
              (_, value) => value,
            ).map((value) => (
              <SelectItem key={`start-${value}`} value={String(value)}>
                {formatQuarterTime(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(endQuarter)} onValueChange={onEndQuarterChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            className="!max-h-40 overflow-y-auto data-[side=bottom]:translate-y-0"
            position="popper"
            showScrollButtons={false}
            matchTriggerHeight={false}
            side="bottom"
            align="start"
            sideOffset={0}
          >
            {Array.from({ length: QUARTER_HOUR_SLOTS + 1 }, (_, value) => value)
              .filter((value) => value > startQuarter)
              .map((value) => (
                <SelectItem key={`end-${value}`} value={String(value)}>
                  {formatQuarterTime(value)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
