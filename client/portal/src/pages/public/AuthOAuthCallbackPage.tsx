import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { signInAndUp } from "supertokens-auth-react/recipe/thirdparty";

import zeroDayTitle from "@/assets/title-login.webp";
import { AuthFlowSkeleton } from "@/components/AuthFlowSkeleton";
import { Button } from "@/components/ui/button";

import MascotField from "./components/MascotField";

export default function AuthOAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const response = await signInAndUp();

        if (response.status === "OK") {
          navigate("/auth/callback");
        } else if (response.status === "NO_EMAIL_GIVEN_BY_PROVIDER") {
          setError(
            "Google did not provide an email address. Please try again or use the magic link option.",
          );
        } else {
          setError("Sign in not allowed. Please contact support.");
        }
      } catch (err) {
        // Sign-in method mismatches arrive as an STGeneralError whose message
        // is already written for the user; anything else is a real failure.
        const message = err instanceof Error ? err.message : "";
        setError(message || "An error occurred during sign in");
      }
    }

    handleCallback();
  }, [navigate]);

  if (error) {
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
        <MascotField />

        <div className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-white/45 uppercase sm:inset-x-8 sm:text-[10px]">
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
                  <p className="font-mono text-[10px] tracking-[0.28em] text-[#F62BE8] uppercase">
                    Access exception // 01
                  </p>
                  <span className="h-1.5 w-1.5 bg-[#F62BE8] shadow-[0_0_10px_#F62BE8]" />
                </div>

                <div className="pt-6">
                  <div className="flex size-11 items-center justify-center border border-[#F62BE8]/45 bg-[#F62BE8]/10 text-[#F62BE8] shadow-[0_0_24px_rgba(246,43,232,0.12)]">
                    <AlertTriangle aria-hidden className="size-5" />
                  </div>
                  <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">
                    Sign-in error.
                  </h1>
                  <p className="mt-2 font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">
                    Identity verification interrupted
                  </p>
                </div>

                <div className="my-6 border-l-2 border-[#F62BE8] bg-[#F62BE8]/[0.07] px-4 py-3.5 text-sm leading-6 text-white/75">
                  {error}
                </div>

                <Button
                  variant="outline"
                  className="zero-cut-button h-12 w-full border-[#21FFF0]/45 bg-transparent text-xs font-medium tracking-[0.16em] text-white uppercase hover:border-[#21FFF0] hover:bg-[#21FFF0]/10 hover:text-white focus-visible:ring-[#21FFF0]/50"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeft aria-hidden className="size-4" />
                  Back to login
                </Button>
              </div>
            </section>

            <p className="mt-4 text-center font-mono text-[9px] tracking-[0.25em] text-white/25 uppercase">
              Zero Day Harp // Recovery node
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <AuthFlowSkeleton />;
}
