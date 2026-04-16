"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[20px] shrink-0 rounded-[6px] border-[1.5px] border-gray-300 bg-background data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background focus-visible:border-foreground aria-invalid:border-destructive transition-colors outline-none disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-[14px]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
