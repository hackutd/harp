import zeroDayTitle from "@/assets/title-login.webp";
import { HackerSkeleton } from "@/components/HackerSkeleton";
import { SkyBackdrop } from "@/components/SkyBackdrop";

interface HackerPageLoaderProps {
  /**
   * Render as a full page on the sign-in night sky. Used outside
   * `HackerLayout` — the auth guard and the lazy layout import — where there is
   * no page chrome for a dashboard-shaped skeleton to fill.
   */
  fullscreen?: boolean;
}

/**
 * Suspense fallback for hacker routes. Inside the layout it is shaped like a
 * dormant dashboard — status panel, date tiles, notification rows — so the
 * most common landing fills in rather than swapping layouts. Full-page, it is
 * the sign-in sky with the title and a scan line, like the auth loader.
 */
export function HackerPageLoader({
  fullscreen = false,
}: HackerPageLoaderProps) {
  if (fullscreen) {
    return (
      <main
        role="status"
        aria-label="Loading"
        className="theme-dark relative isolate flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden bg-black px-5 text-white"
      >
        <SkyBackdrop />
        <img
          src={zeroDayTitle}
          alt="HackUTD Zero Day"
          className="w-full max-w-[430px] object-contain"
        />
        <div className="zero-scan-track h-px w-full max-w-[220px] overflow-hidden bg-white/10">
          <div className="zero-scan-line h-px w-1/4 bg-ice" />
        </div>
      </main>
    );
  }

  return (
    <div role="status" aria-label="Loading" className="hacker-dashboard">
      <div className="mx-auto max-w-2xl p-5 md:max-w-5xl">
        <div className="rounded-xl bg-surface p-5">
          <HackerSkeleton className="h-6 w-28 rounded-full bg-ice/15" />
          <HackerSkeleton className="mt-4 h-6 w-3/5" />
          <HackerSkeleton className="mt-3 h-3 w-2/5" />
          <HackerSkeleton className="mt-4 h-1 w-full rounded-full" />
          <HackerSkeleton className="mt-5 h-9 w-32 rounded-full bg-ice/15" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-lg bg-surface p-4 theme-light:border theme-light:border-ink/10"
            >
              <HackerSkeleton className="h-2.5 w-8" />
              <HackerSkeleton className="mt-3 h-7 w-12" />
              <HackerSkeleton className="mt-3 h-2.5 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <HackerSkeleton className="h-4 w-32" />
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3.5 theme-light:border theme-light:border-ink/10"
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
