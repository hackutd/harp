import zeroDayTitle from "@/assets/title-login.webp";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the three public auth-flow pages (verify, callback, OAuth
 * callback). It deliberately mirrors the Zero Day panel those pages resolve
 * into — same canvas, HUD rail, title lockup, and panel geometry — so the
 * handoff reads as the panel filling in rather than a new screen.
 */
export function AuthFlowSkeleton() {
  return (
    <main className="zero-login relative isolate min-h-svh overflow-hidden bg-black text-white">
      <div
        aria-hidden
        className="zero-login-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="zero-login-scanlines pointer-events-none absolute inset-0 z-20"
      />

      <div className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-white/45 uppercase sm:inset-x-8 sm:text-[10px]">
        <span>HackUTD // Secure portal</span>
        <span>MMXXVI</span>
      </div>

      <div className="relative z-30 flex min-h-svh items-center justify-center px-5 py-16">
        <div
          className="w-full max-w-[520px]"
          role="status"
          aria-label="Signing you in"
        >
          <img
            src={zeroDayTitle}
            alt="HackUTD Zero Day"
            className="mx-auto mb-5 w-full max-w-[430px] object-contain"
          />

          <section className="zero-login-panel relative p-px">
            <div className="zero-login-panel-inner px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <p className="font-mono text-[10px] tracking-[0.28em] text-[#21FFF0] uppercase">
                  Secure channel // Verifying
                </p>
                <span className="h-1.5 w-1.5 animate-pulse bg-[#21FFF0] shadow-[0_0_10px_#21FFF0]" />
              </div>

              <div className="pt-6">
                <Skeleton className="size-11 rounded-none bg-white/[0.07]" />
                <Skeleton className="mt-5 h-8 w-3/5 rounded-none bg-white/[0.07]" />
                <Skeleton className="mt-3 h-2.5 w-2/5 rounded-none bg-white/[0.05]" />
              </div>

              <div className="zero-scan-track my-6 h-px w-full overflow-hidden bg-white/10">
                <div className="zero-scan-line h-px w-1/4 bg-[#21FFF0] shadow-[0_0_10px_#21FFF0]" />
              </div>

              <div className="space-y-3">
                <Skeleton className="zero-cut-button h-12 w-full bg-[#5900FF]/25" />
                <Skeleton className="zero-cut-button h-12 w-full bg-white/[0.05]" />
              </div>
            </div>
          </section>

          <p className="mt-4 text-center font-mono text-[9px] tracking-[0.25em] text-white/25 uppercase">
            Zero Day Harp // Establishing session
          </p>
        </div>
      </div>
    </main>
  );
}
