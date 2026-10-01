import {
  HackerSkeleton,
  HackerSkeletonStatus,
} from "@/components/HackerSkeleton";
import { cn } from "@/shared/lib/utils";

interface HackerPageLoaderProps {
  /**
   * Paint the Zero Day canvas too. Needed when the loader renders outside
   * `HackerLayout` — the auth guard and the lazy layout import — where the
   * page would otherwise flash the portal's light background.
   */
  fullscreen?: boolean;
}

/**
 * Suspense fallback for hacker routes. Shaped like a dormant dashboard —
 * status panel, date tiles, notification rows — so the most common landing
 * fills in rather than swapping layouts.
 */
export function HackerPageLoader({
  fullscreen = false,
}: HackerPageLoaderProps) {
  return (
    <div
      role="status"
      className={cn(
        fullscreen &&
          "hacker-zero-theme zero-hacker-surface min-h-svh text-white",
      )}
    >
      <div className="mx-auto max-w-2xl px-5 pt-4 pb-6 md:max-w-5xl md:px-8 md:pt-6">
        <HackerSkeletonStatus label="Portal" />

        <div className="mt-4 rounded-xl border border-[#A857FF]/20 bg-[#0B0C15]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <HackerSkeleton className="h-6 w-28 rounded-full bg-[#5900FF]/20" />
          <HackerSkeleton className="mt-4 h-6 w-3/5" />
          <HackerSkeleton className="mt-3 h-3 w-2/5" />
          <HackerSkeleton className="mt-4 h-1 w-full rounded-full" />
          <HackerSkeleton className="mt-5 h-9 w-32 rounded-full bg-[#5900FF]/20" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/10 bg-[#0B0C15]/70 p-4"
            >
              <HackerSkeleton className="h-2.5 w-8" />
              <HackerSkeleton className="mt-3 h-7 w-12" />
              <HackerSkeleton className="mt-3 h-2.5 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <HackerSkeleton className="h-4 w-32" />
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0B0C15]/70 px-4 py-3.5"
            >
              <HackerSkeleton className="size-2 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <HackerSkeleton className="h-3.5 w-1/2" />
                <HackerSkeleton className="mt-2 h-2.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
