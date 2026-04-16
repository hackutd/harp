/* eslint-disable react-refresh/only-export-components */
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[4px] text-[14px] tracking-[-0.14px] font-medium border border-gray-200 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:text-gray-400 disabled:border-gray-200 data-[state=on]:border-foreground data-[state=on]:bg-background [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 outline-none aria-invalid:border-destructive whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "bg-transparent",
      },
      size: {
        default: "px-[14px] py-[10px] min-w-9",
        sm: "px-[10px] py-[8px] min-w-8 text-[12px] tracking-[-0.3px]",
        lg: "px-[18px] py-[14px] min-w-10 text-[16px] tracking-[-0.4px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
