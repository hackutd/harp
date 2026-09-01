import { Lock, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  /**
   * Option values the backend keys off (e.g. the travel mode that requires a
   * receipt). They can be reordered but not renamed or removed, since either
   * would silently switch the rule behind them off.
   */
  lockedOptions?: string[];
}

export function OptionsEditor({
  options,
  onChange,
  lockedOptions,
}: OptionsEditorProps) {
  const locked = new Set(lockedOptions ?? []);

  const updateOption = (index: number, value: string) => {
    onChange(options.map((o, i) => (i === index ? value : o)));
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const addOption = () => {
    onChange([...options, ""]);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        Options
      </label>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={option}
            onChange={(e) => updateOption(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
            className="h-8 text-sm"
            readOnly={locked.has(option)}
            title={
              locked.has(option)
                ? "This answer is read by the backend and cannot be renamed."
                : undefined
            }
          />
          {locked.has(option) ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
              <Lock className="size-3.5" />
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeOption(index)}
              className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-red-500 cursor-pointer"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={addOption}
        className="w-full border-dashed cursor-pointer h-8 text-xs"
      >
        <Plus className="size-3 mr-1.5" />
        Add Option
      </Button>
    </div>
  );
}
