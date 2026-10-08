import {
  IconAlertTriangle,
  IconArrowLeft,
  IconClock,
  IconUnlink,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { consumeCode } from "supertokens-auth-react/recipe/passwordless";

import zeroDayTitle from "@/assets/title-login.webp";
import { AuthFlowSkeleton } from "@/components/AuthFlowSkeleton";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { Button } from "@/components/ui/button";

type VerifyStatus = "verifying" | "success" | "expired" | "invalid" | "error";

type Failure = Exclude<VerifyStatus, "verifying" | "success">;

/** Per-failure presentation. The message itself comes from the verify call. */
const FAILURES: Record<
  Failure,
  { icon: typeof IconAlertTriangle; title: string; note: string }
> = {
  expired: {
    icon: IconClock,
    title: "Link expired.",
    note: "Magic link is no longer valid",
  },
  invalid: {
    icon: IconUnlink,
    title: "Invalid link.",
    note: "Token failed verification",
  },
  error: {
    icon: IconAlertTriangle,
    title: "Verification failed.",
    note: "Identity verification interrupted",
  },
};

export default function AuthVerify() {
  const [status, setStatus] = useState<VerifyStatus>("verifying");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await consumeCode();

        if (response.status === "OK") {
          setStatus("success");
          // Redirect to callback to fetch user and route appropriately
          navigate("/auth/callback", { replace: true });
        } else if (response.status === "INCORRECT_USER_INPUT_CODE_ERROR") {
          setStatus("invalid");
          setError("The link is invalid. Please request a new one.");
        } else if (response.status === "EXPIRED_USER_INPUT_CODE_ERROR") {
          setStatus("expired");
          setError("The link has expired. Please request a new one.");
        } else if (response.status === "RESTART_FLOW_ERROR") {
          setStatus("expired");
          setError("The session has expired. Please start over.");
        } else {
          setStatus("error");
          setError("An unexpected error occurred.");
        }
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Failed to verify magic link",
        );
      }
    };

    verify();
  }, [navigate]);

  // "success" redirects on the same tick, so it keeps the loading state rather
  // than flashing a failure panel with nothing to report.
  if (status === "verifying" || status === "success") {
    return <AuthFlowSkeleton />;
  }

  const { icon: Icon, title, note } = FAILURES[status];

  return (
    <main className="zero-login relative isolate min-h-svh overflow-hidden bg-black text-white">
      <SkyBackdrop />

      <div className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-white/55 uppercase sm:inset-x-8 sm:text-[10px]">
        <span>HackUTD // Secure portal</span>
        <span>MMXXVI</span>
      </div>

      <div className="relative z-30 flex min-h-svh items-center justify-center px-5 py-16">
        <div className="w-full max-w-[520px]">
          <img
            src={zeroDayTitle}
            alt="HackUTD Zero Day"
            className="mx-auto mb-5 w-full max-w-[430px] object-contain"
          />

          <section className="zero-login-panel relative p-px">
            <div className="zero-login-panel-inner px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <p className="font-mono text-[10px] tracking-[0.28em] text-ice uppercase">
                  Access exception // 02
                </p>
                <span className="h-1.5 w-1.5 bg-ice" />
              </div>

              <div className="pt-6">
                <div className="flex size-11 items-center justify-center border border-ice/50 bg-ice/10 text-ice">
                  <Icon aria-hidden className="size-5" />
                </div>
                <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">
                  {title}
                </h1>
                <p className="mt-2 font-mono text-[10px] tracking-[0.18em] text-white/55 uppercase">
                  {note}
                </p>
              </div>

              <div className="my-6 border-l-2 border-ice bg-ice/10 px-4 py-3.5 text-sm leading-6 text-white/75">
                {error}
              </div>

              <div className="space-y-3">
                <Button
                  className="zero-cut-button h-12 w-full bg-tide text-xs font-semibold tracking-[0.18em] text-white uppercase hover:bg-tide-hover focus-visible:ring-ice/50"
                  onClick={() => navigate("/")}
                >
                  Request new magic link
                </Button>
                <Button
                  variant="outline"
                  className="zero-cut-button h-12 w-full border-ice/50 bg-transparent text-xs font-medium tracking-[0.16em] text-white uppercase hover:border-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-ice/50"
                  onClick={() => navigate("/")}
                >
                  <IconArrowLeft aria-hidden className="size-4" />
                  Back to home
                </Button>
              </div>
            </div>
          </section>

          <p className="mt-4 text-center font-mono text-[9px] tracking-[0.25em] text-white/40 uppercase">
            Zero Day Harp // Verification node
          </p>
        </div>
      </div>
    </main>
  );
}
