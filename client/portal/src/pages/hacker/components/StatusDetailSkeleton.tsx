import {
  HackerSkeleton,
  HackerSkeletonStatus,
} from "@/components/HackerSkeleton";

interface StatusDetailSkeletonProps {
  /** What is loading, e.g. "Application". */
  label: string;
}

// Row widths vary so the summary reads as answers rather than a grid.
const SUMMARY_ROWS = [
  ["w-1/3", "w-1/4"],
  ["w-2/5", "w-1/3"],
  ["w-1/4", "w-2/5"],
  ["w-1/3", "w-1/5"],
] as const;

/**
 * Loading state shared by the application, RSVP, and travel RSVP detail pages.
 * Mirrors their loaded layout — back chevron, result card, then the "Your
 * submission" summary panel — so the page fills in rather than reflowing.
 */
export function StatusDetailSkeleton({ label }: StatusDetailSkeletonProps) {
  return (
    <div
      role="status"
      className="mx-auto flex max-w-2xl flex-col gap-3 px-5 pt-4 pb-8 md:max-w-5xl md:flex-row md:items-start md:gap-2 md:px-8"
    >
      <div className="-ml-3 flex size-9 shrink-0 items-center justify-center md:-ml-10">
        <HackerSkeleton className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <HackerSkeletonStatus label={label} />

        <div className="mt-4 rounded-xl border border-[#A857FF]/20 bg-[#0B0C15]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <HackerSkeleton className="h-6 w-28 rounded-full bg-[#5900FF]/20" />
          <HackerSkeleton className="mt-4 h-6 w-3/5" />
          <HackerSkeleton className="mt-3 h-3 w-full" />
          <HackerSkeleton className="mt-2 h-3 w-4/5" />
        </div>

        <section className="mt-6">
          <HackerSkeleton className="h-2.5 w-28" />
          <div className="mt-3 rounded-xl border border-white/10 bg-[#0B0C15]/60 p-4">
            <HackerSkeleton className="h-3.5 w-1/3" />
            <div className="mt-3 divide-y divide-white/8">
              {SUMMARY_ROWS.map(([labelWidth, valueWidth], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <HackerSkeleton className={`h-3 ${labelWidth}`} />
                  <HackerSkeleton className={`h-3 ${valueWidth}`} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
