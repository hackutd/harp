/* eslint-disable react-refresh/only-export-components */
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[8px] whitespace-nowrap rounded-full font-medium text-[14px] leading-[1.2] tracking-[-0.14px] transition-all disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary hover:bg-gray-800 disabled:bg-gray-100 disabled:border-gray-100 disabled:text-gray-600",
        destructive:
          "bg-destructive text-white border border-destructive hover:bg-error-600 disabled:bg-error-100 disabled:border-error-100 disabled:text-error-300",
        outline:
          "bg-transparent text-foreground border border-gray-200 hover:border-foreground hover:bg-gray-100 disabled:border-gray-400 disabled:text-gray-400",
        secondary:
          "bg-background text-foreground border border-background hover:bg-gray-100 disabled:bg-gray-800 disabled:border-gray-800 disabled:text-gray-500",
        ghost:
          "bg-transparent text-foreground hover:bg-gray-100 disabled:text-gray-400",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "px-[20px] py-[8px] h-auto",
        sm: "px-[14px] py-[6px] text-[12px] tracking-[-0.3px]",
        lg: "px-[28px] py-[12px] text-[16px] tracking-[-0.4px]",
        icon: "size-[36px] p-0 rounded-full",
        "icon-sm": "size-[28px] p-0 rounded-full",
        "icon-lg": "size-[44px] p-0 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
