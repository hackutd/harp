/* eslint-disable react-refresh/only-export-components */
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full px-[8px] py-[3px] text-[12px] tracking-[-0.18px] font-medium leading-[1.2] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 aria-invalid:border-destructive transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background [a&]:hover:bg-gray-800",
        secondary: "bg-gray-100 text-foreground [a&]:hover:bg-gray-200",
        destructive: "bg-error-100 text-error-700 [a&]:hover:bg-error-200",
        outline:
          "border border-gray-200 text-foreground [a&]:hover:bg-gray-100",
        success: "bg-success-100 text-success-700 [a&]:hover:bg-success-200",
        warning: "bg-warning-100 text-warning-700 [a&]:hover:bg-warning-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
