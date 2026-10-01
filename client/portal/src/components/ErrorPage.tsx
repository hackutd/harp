import { ArrowLeft, Home, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

import { Button } from "@/components/ui/button";
import { isChunkLoadError } from "@/shared/lib/stale-chunk-reload";

/**
 * Static rather than the super admin's runtime `contact_email`: this page is
 * the router's error boundary, so it has to render when the API, the session,
 * or the route that would have loaded that setting is exactly what failed.
 */
const SUPPORT_EMAIL = "hello@hackutd.co";

type ErrorCopy = {
  status: string;
  /** In-world HUD label. The plain-language title carries the real meaning. */
  label: string;
  title: string;
  message: string;
  /** Raw error text, surfaced only as a trace the hacker can quote to us. */
  detail?: string;
};

const NOT_FOUND: ErrorCopy = {
  status: "404",
  label: "Signal lost",
  title: "Page not found.",
  message: "The page you're looking for doesn't exist or may have moved.",
};

function describeError(error: unknown): ErrorCopy {
  // The catch-all `*` route renders this page as an ordinary element rather
  // than as an error boundary, so a mistyped URL arrives with no error at all.
  // That is a 404, not the unexpected-failure case below.
  if (error == null) return NOT_FOUND;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return NOT_FOUND;
    }
    if (error.status === 401) {
      return {
        status: "401",
        label: "Identity unverified",
        title: "Not signed in.",
        message: "You need to sign in to view this page.",
      };
    }
    if (error.status === 403) {
      return {
        status: "403",
        label: "Access denied",
        title: "Clearance required.",
        message: "You don't have permission to access this page.",
      };
    }
    return {
      status: String(error.status),
      label: "System fault",
      title: "Something broke.",
      message:
        "An unexpected error occurred while loading this page. Please try again.",
      detail: error.statusText || undefined,
    };
  }

  return {
    status: "500",
    label: "System fault",
    title: "Something broke.",
    message:
      // Non-breaking space keeps the em dash off the start of a wrapped line.
      "An unexpected error occurred. Try again, or head back home — this one is on us, not you.",
    detail: error instanceof Error && error.message ? error.message : undefined,
  };
}

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { status, label, title, message, detail } = describeError(error);
  // A missing content-hashed chunk means this tab predates a deploy. Only a
  // reload fetches the fresh shell; in-app navigation keeps the stale one.
  const staleBuild = detail != null && isChunkLoadError(detail);

  return (
    <main className="zero-login relative isolate flex min-h-svh flex-col overflow-hidden bg-black text-white">
      <div
        aria-hidden
        className="zero-login-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="zero-login-scanlines pointer-events-none absolute inset-0 z-20"
      />

      {/* HUD rail — atmosphere only, never the carrier of meaning. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-white/45 uppercase sm:inset-x-8 sm:text-[10px] lg:inset-x-12"
      >
        <span>HackUTD // Secure portal</span>
        <span>MMXXVI</span>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 z-30 hidden -translate-y-1/2 font-mono text-[9px] tracking-[0.4em] text-white/25 uppercase [writing-mode:vertical-rl] lg:block"
      >
        HACKUTD // ZERO DAY
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-20 sm:px-8">
        <div className="zero-login-panel relative w-full max-w-[560px] p-px">
          <div className="zero-login-panel-inner px-5 py-6 sm:px-8 sm:py-9">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
              <p className="font-mono text-[10px] tracking-[0.28em] text-[#21FFF0] uppercase">
                {label} // {status}
              </p>
              <div className="flex items-center gap-1" aria-hidden>
                <span className="h-1 w-5 bg-[#5900FF]" />
                <span className="h-1 w-2 bg-[#F62BE8]" />
                <span className="h-1 w-1 bg-[#21FFF0]" />
              </div>
            </div>

            <div className="pt-5 sm:pt-7">
              {/* Chromatic split — one deliberate glitch artifact, held still. */}
              <p
                aria-hidden
                className="text-6xl leading-none font-semibold tracking-[-0.06em] text-white [text-shadow:3px_0_16px_rgba(246,43,232,0.55),-3px_0_16px_rgba(33,255,240,0.45)] sm:text-7xl"
              >
                {status}
              </p>
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white sm:mt-5 sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-md text-xs leading-5 text-white/55 sm:mt-3 sm:text-sm sm:leading-6">
                {message}
              </p>
            </div>

            {detail && (
              <div className="zero-cut-sm mt-5 border border-[#F62BE8]/30 bg-[#F62BE8]/[0.06] px-3.5 py-3 sm:mt-6">
                <p className="font-mono text-[10px] tracking-[0.22em] text-[#ff9af8] uppercase">
                  Trace
                </p>
                <p className="mt-1.5 font-mono text-[11px] leading-5 break-words text-white/70">
                  {detail}
                </p>
              </div>
            )}

            {staleBuild && (
              <Button
                className="zero-cut-button mt-6 h-11 w-full bg-[#21FFF0] text-xs font-medium tracking-[0.18em] text-black uppercase shadow-[0_0_20px_rgba(33,255,240,0.28)] hover:bg-[#5cfff4] focus-visible:ring-[#21FFF0]/50 sm:mt-7 sm:h-12"
                onClick={() => window.location.reload()}
              >
                <RefreshCw aria-hidden className="mr-1.5 size-4" />A new version
                is available — reload
              </Button>
            )}

            <div
              className={`${staleBuild ? "mt-2.5" : "mt-6 sm:mt-7"} flex flex-col gap-2.5 sm:flex-row`}
            >
              <Button
                variant="outline"
                className="zero-cut-button h-11 w-full border-[#21FFF0]/45 bg-transparent text-xs font-medium tracking-[0.18em] text-white uppercase hover:border-[#21FFF0] hover:bg-[#21FFF0]/10 hover:text-white focus-visible:ring-[#21FFF0]/50 sm:h-12 sm:flex-1"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft aria-hidden className="mr-1.5 size-4" />
                Go back
              </Button>
              <Button
                className="zero-cut-button h-11 w-full bg-[#5900FF] text-xs font-medium tracking-[0.18em] text-white uppercase shadow-[0_0_20px_rgba(89,0,255,0.28)] hover:bg-[#6D1CFF] focus-visible:ring-[#5900FF]/50 sm:h-12 sm:flex-1"
                onClick={() => navigate("/")}
              >
                <Home aria-hidden className="mr-1.5 size-4" />
                Go home
              </Button>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 sm:mt-6 sm:pt-5">
              <p className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
                Still stuck?
              </p>
              <p className="mt-1.5 text-xs leading-5 text-white/55 sm:text-sm sm:leading-6">
                If you think this is a real issue, reach out at{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                    `Portal error ${status}`,
                  )}`}
                  className="zero-login-legal-link text-[#21FFF0]"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                and we'll take a look.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
