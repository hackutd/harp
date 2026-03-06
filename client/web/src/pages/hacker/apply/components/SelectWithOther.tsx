import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  value: string;
  label: string;
}

interface SelectWithOtherProps {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  otherPlaceholder?: string;
  disabled?: boolean;
}

export function SelectWithOther({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  otherPlaceholder = "Please specify...",
  disabled,
}: SelectWithOtherProps) {
  // Check if current value is a predefined option
  const isPredefinedValue = options.some((opt) => opt.value === value);

  // Determine initial state: show input if value exists but isn't a predefined option
  const getInitialOtherMode = () => {
    if (!value) return false;
    if (value === "other") return true;
    return !isPredefinedValue;
  };

  const [isOtherMode, setIsOtherMode] = React.useState(getInitialOtherMode);
  const [customValue, setCustomValue] = React.useState(
    value && !isPredefinedValue && value !== "other" ? value : "",
  );

  // Only sync from props on mount - intentionally empty deps to run once
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (value && !isPredefinedValue && value !== "other") {
        setIsOtherMode(true);
        setCustomValue(value);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectChange = (newValue: string) => {
    if (newValue === "other") {
      setIsOtherMode(true);
      setCustomValue("");
      onChange?.(""); // Clear value until they type
    } else {
      setIsOtherMode(false);
      setCustomValue("");
      onChange?.(newValue);
    }
  };

  const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCustomValue = e.target.value;
    setCustomValue(newCustomValue);
    onChange?.(newCustomValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Blur the input to indicate the value is saved
      (e.target as HTMLInputElement).blur();
    }
  };

  // Determine what to show in the select
  const selectValue = isOtherMode ? "other" : value || "";

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isOtherMode && (
        <Input
          value={customValue}
          onChange={handleOtherInputChange}
          onKeyDown={handleKeyDown}
          placeholder={otherPlaceholder}
          disabled={disabled}
          autoFocus
          className="w-1/4"
        />
      )}
    </div>
  );
}
