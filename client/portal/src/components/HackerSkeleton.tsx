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
 * Zero Day placeholder block for hacker-side loading states: a dim panel
 * with a slow cyan sweep. Pair with `HackerSkeletonStatus` so every loading
 * screen opens with the same HUD line.
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

interface HackerSkeletonStatusProps {
  /** What is loading, e.g. "Schedule". Rendered as `Loading // Schedule`. */
  label: string;
  className?: string;
}

/** Mono HUD status line that heads a hacker-side loading state. */
export function HackerSkeletonStatus({
  label,
  className,
}: HackerSkeletonStatusProps) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 font-mono text-[10px] tracking-[0.28em] text-[#21FFF0]/80 uppercase",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 animate-pulse bg-[#21FFF0] shadow-[0_0_10px_#21FFF0]"
      />
      Loading // {label}
    </p>
  );
}

interface HackerSkeletonEmbedProps {
  label: string;
  className?: string;
}

/**
 * Loading state for a large embedded surface (iframe, PDF, receipt image).
 * A single block that big reads as a glitch, so this centres the status line
 * and the auth flow's scan track instead.
 */
export function HackerSkeletonEmbed({
  label,
  className,
}: HackerSkeletonEmbedProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex size-full flex-col items-center justify-center gap-5 px-6",
        className,
      )}
    >
      <HackerSkeletonStatus label={label} />
      <div className="zero-scan-track h-px w-full max-w-[220px] overflow-hidden bg-white/10">
        <div className="zero-scan-line h-px w-1/4 bg-[#21FFF0] shadow-[0_0_10px_#21FFF0]" />
      </div>
    </div>
  );
}
