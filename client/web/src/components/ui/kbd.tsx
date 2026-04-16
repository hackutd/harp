import { cn } from "@/shared/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "border border-gray-200 bg-gray-100 text-gray-700 pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-[2px] px-[6px] py-[2px] font-sans text-[12px] tracking-[-0.3px] font-medium select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background [[data-slot=tooltip-content]_&]:border-transparent dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
