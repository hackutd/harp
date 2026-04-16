import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground selection:bg-primary selection:text-primary-foreground h-[54px] w-full min-w-0 rounded-[6px] border border-gray-600 bg-background px-[10px] py-[15px] text-[16px] tracking-[-0.4px] text-foreground placeholder:text-gray-600 transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
        "focus-visible:border-foreground",
        "aria-invalid:border-destructive aria-invalid:placeholder:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
