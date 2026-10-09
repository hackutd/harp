import { cn } from "@/shared/lib/utils";

type SkeletonCut = "none" | "sm" | "md";

// Clipped corners follow the login panel geometry. Thin text bars stay sharp
// because an 8px cut would swallow most of their height.
const CUT_CLASS: Record<SkeletonCut, string> = {
  none: "",
  sm: "zero-cut-sm",
  md: "zero-cut-button",
};

interface HackerSkeletonProps extends React.ComponentProps<"div"> {
  cut?: SkeletonCut;
}

/**
 * Placeholder block for hacker-side loading states: a faint white panel that
 * breathes (`.zero-skeleton` in index.css).
 */
export function HackerSkeleton({
  className,
  cut = "none",
  ...props
}: HackerSkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("zero-skeleton", CUT_CLASS[cut], className)}
      {...props}
    />
  );
}
