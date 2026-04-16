import { Search } from "lucide-react";
import type * as React from "react";

import { cn } from "@/shared/lib/utils";

import { Input } from "./input";

interface SearchFieldProps extends React.ComponentProps<"input"> {
  containerClassName?: string;
}

function SearchField({
  className,
  containerClassName,
  ...props
}: SearchFieldProps) {
  return (
    <div
      className={cn(
        "group relative w-full after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-center after:scale-x-0 after:bg-foreground after:opacity-0 after:transition-all after:duration-300 after:ease-out focus-within:after:scale-x-100 focus-within:after:opacity-100",
        containerClassName,
      )}
    >
      <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors duration-300 ease-out group-focus-within:text-foreground" />
      <Input
        className={cn(
          "h-9 w-full rounded-none border-0 bg-transparent px-0 py-0 pl-7 text-[15px] shadow-none transition-[color,opacity] duration-300 ease-out placeholder:font-light placeholder:text-gray-500 focus-visible:ring-0 focus-visible:outline-none group-focus-within:placeholder:text-gray-400",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export { SearchField };
