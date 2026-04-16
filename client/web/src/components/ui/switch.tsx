"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[24px] w-[40px] shrink-0 items-center rounded-full border border-transparent p-[2px] bg-gray-200 data-[state=checked]:bg-success-400 focus-visible:ring-3 focus-visible:ring-gray-100 transition-colors outline-none disabled:cursor-not-allowed disabled:bg-gray-100",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[20px] rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[16px] data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
