import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/shared/lib/utils";

import { POPULAR_UNIVERSITIES, searchUniversities } from "../api";

interface UniversityComboboxProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function UniversityCombobox({
  value,
  onChange,
  placeholder = "Select university...",
  disabled,
}: UniversityComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [universities, setUniversities] =
    React.useState<string[]>(POPULAR_UNIVERSITIES);
  const [loading, setLoading] = React.useState(false);

  // Debounced search
  React.useEffect(() => {
    if (searchQuery.length < 2) {
      setUniversities(POPULAR_UNIVERSITIES);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchUniversities(searchQuery);
        if (results.length > 0) {
          const names = [...new Set(results.map((u) => u.name))];
          setUniversities(names.slice(0, 50));
        } else {
          setUniversities(POPULAR_UNIVERSITIES);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelect = (selectedValue: string) => {
    onChange?.(selectedValue);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search universities..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <p className="text-sm text-muted-foreground">
                    No universities found.
                  </p>
                </CommandEmpty>
                <CommandGroup>
                  {universities.map((university) => (
                    <CommandItem
                      key={university}
                      value={university}
                      onSelect={() => handleSelect(university)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === university ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{university}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {searchQuery.length >= 2 &&
                  !universities.includes(searchQuery) && (
                    <CommandGroup heading="Can't find yours?">
                      <CommandItem
                        value={searchQuery}
                        onSelect={() => handleSelect(searchQuery)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === searchQuery ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Use "{searchQuery}"
                      </CommandItem>
                    </CommandGroup>
                  )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}