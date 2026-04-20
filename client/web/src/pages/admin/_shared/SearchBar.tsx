import { Search } from "lucide-react";
import { useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search by name or email",
}: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(!!value);

  const handleBlur = () => {
    if (!value) setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onChange("");
      setIsOpen(false);
    }
  };

  return (
    <div className="flex items-center">
      {!isOpen ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Search"
              onClick={() => setIsOpen(true)}
              className="flex items-center rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer"
            >
              <Search className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>
      ) : (
        <div className="relative flex items-center gap-2 w-56 p-1.5">
          <Search className="h-4 w-4 shrink-0 text-foreground" />
          <input
            autoFocus
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:font-light placeholder:text-foreground"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-px origin-left bg-foreground animate-[underline-grow_300ms_ease-out_forwards]"
          />
        </div>
      )}
    </div>
  );
}
