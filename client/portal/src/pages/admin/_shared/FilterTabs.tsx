import { SegmentedHighlight } from "@/components/SegmentedHighlight";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

export interface FilterTabOption {
  value: string;
  label: string;
  /** Shown as a badge beside the label; omit to show none. */
  count?: number;
}

interface FilterTabsProps {
  options: FilterTabOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  "aria-label": string;
}

function CountBadge({
  count,
  className,
}: {
  count?: number;
  className?: string;
}) {
  if (count === undefined) return null;
  return (
    <Badge variant="secondary" className={cn("px-1.5 py-0 text-xs", className)}>
      {count}
    </Badge>
  );
}

/**
 * A filter row that is a segmented tab list when its toolbar is wide, and a
 * dropdown when it is not (a half-width window, or a narrow content area
 * beside the sidebar). The width check is a container query, so the parent
 * toolbar must carry the `@container` class.
 */
export function FilterTabs({
  options,
  value,
  onValueChange,
  disabled,
  "aria-label": ariaLabel,
}: FilterTabsProps) {
  return (
    <>
      <Tabs
        value={value}
        onValueChange={onValueChange}
        className="hidden min-w-0 @5xl:flex"
      >
        <TabsList
          aria-label={ariaLabel}
          className="relative h-9 gap-0 rounded-md border bg-toggle-track p-0.5"
        >
          <SegmentedHighlight />
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              disabled={disabled}
              className="cursor-pointer rounded-sm font-light text-muted-foreground hover:text-foreground relative data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {option.label}
              <CountBadge count={option.count} className="ml-1.5" />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          aria-label={ariaLabel}
          className="cursor-pointer bg-card font-light @5xl:hidden"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          matchTriggerHeight={false}
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="font-light focus:bg-admin-panel data-[state=checked]:bg-admin-panel"
            >
              {option.label}
              <CountBadge count={option.count} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
