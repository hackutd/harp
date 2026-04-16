import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[100px] w-full rounded-[6px] border border-gray-300 bg-background px-[10px] py-[15px] text-[16px] tracking-[-0.4px] text-foreground placeholder:text-gray-400 transition-colors outline-none focus-visible:border-foreground aria-invalid:border-destructive aria-invalid:placeholder:text-destructive disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
