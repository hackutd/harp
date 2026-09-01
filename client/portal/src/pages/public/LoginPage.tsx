import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { createCode } from "supertokens-auth-react/recipe/passwordless";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import googleIcon from "@/assets/google_icon.webp";
import logo from "@/branding/assets/logo.webp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isGoogleAuthEnabled } from "@/shared/auth";
import { checkEmailAuthMethod } from "@/shared/lib/api";

import { fetchLegalConfig } from "./api";
import type { LegalConfig } from "./types";

type LoginState = "email" | "sending" | "sent" | "error";

export default function Login() {
  const session = useSessionContext();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("email");
  const [error, setError] = useState("");
  const [legal, setLegal] = useState<LegalConfig | null>(null);

  // Must run before the redirect below — hooks cannot sit after an early return.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetchLegalConfig(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setLegal(res.data);
      }
      // Deliberately silent: an operator that has published no policies should
      // not greet every visitor with an error toast on the sign-in screen.
    }
    load();
    return () => controller.abort();
  }, []);

  // Redirect if already logged in
  if (!session.loading && session.doesSessionExist) {
    return <Navigate to="/app" replace />;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");

    // Check if email exists with different auth method
    const checkRes = await checkEmailAuthMethod(email);
    if (checkRes.status === 200 && checkRes.data?.exists) {
      if (checkRes.data.auth_method === "google") {
        setState("error");
        setError(
          "This email is registered with Google. Please use the Google sign-in option instead.",
        );
        return;
      }
    }

    try {
      const response = await createCode({ email });

      if (response.status === "OK") {
        setState("sent");
      } else {
        setState("error");
        setError("Failed to send magic link. Please try again.");
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleGoogleLogin = async () => {
    if (email) {
      const checkRes = await checkEmailAuthMethod(email);
      if (checkRes.status === 200 && checkRes.data?.exists) {
        if (checkRes.data.auth_method === "passwordless") {
          setState("error");
          setError(
            "This email is registered with magic link sign-in. Please use the email option instead.",
          );
          return;
        }
      }
    }

    try {
      await redirectToThirdPartyLogin({ thirdPartyId: "google" });
    } catch (err) {
      setState("error");
      setError(
        err instanceof Error ? err.message : "Failed to initiate Google login",
      );
    }
  };

  const handleReset = () => {
    setState("email");
    setError("");
  };

  // Email sent confirmation screen
  if (state === "sent") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-white px-6">
        <div className="w-full max-w-xs space-y-8 text-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-black">
              Check your email
            </h1>
            <p className="mt-3 text-sm font-light text-[#8A8A8A]">
              We've sent a magic link to{" "}
              <span className="font-normal text-black">{email}</span>
            </p>
          </div>
          <p className="text-sm font-light text-[#8A8A8A]">
            Click the link in the email to sign in. The link expires in 15
            minutes.
          </p>
          <Button
            variant="outline"
            className="h-12 w-full rounded-full border-[#E5E5E5] text-sm font-normal"
            onClick={handleReset}
          >
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  // Email input form
  return (
    <div className="flex min-h-svh items-center justify-center bg-white px-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-4">
            <img src={logo} alt="" className="h-18 w-18 shrink-0" />
            <h1 className="text-left text-sm leading-snug font-medium text-[#8A8A8A]">
              <span className="block">
                <span className="text-black">H</span>ackathon
              </span>
              <span className="block">
                <span className="text-black">A</span>pplication
              </span>
              <span className="block">
                <span className="text-black">R</span>eview
              </span>
              <span className="block">
                <span className="text-black">P</span>latform
              </span>
            </h1>
          </div>
          <span className="mx-auto mt-4 block h-px w-10 bg-[#E5E5E5]" />
          <p className="mt-4 text-sm font-light text-[#8A8A8A]">
            Login or create an account
          </p>
        </div>

        <div className="space-y-5">
          {state === "error" && error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Magic Link Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-5">
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="caleb@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={state === "sending"}
                className="peer block h-11 w-full border-b border-[#E5E5E5] bg-transparent text-sm font-light text-black placeholder:text-[#B8B8B8] focus:outline-none"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-0 bottom-0 left-0 h-px origin-left scale-x-0 bg-black transition-transform duration-500 ease-out peer-focus:scale-x-100"
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
              disabled={!email}
              loading={state === "sending"}
            >
              {state === "sending"
                ? "Sending magic link..."
                : "Send magic link"}
            </Button>
          </form>

          {/* Google OAuth Button (only if enabled) */}
          {isGoogleAuthEnabled && (
            <>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-[#E5E5E5]" />
                <span className="text-xs font-light text-[#B8B8B8]">or</span>
                <span className="h-px flex-1 bg-[#E5E5E5]" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-full border-[#E5E5E5] text-sm font-normal"
                onClick={handleGoogleLogin}
              >
                <img src={googleIcon} alt="" className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>
            </>
          )}

          {(legal?.terms_url || legal?.privacy_policy_url) && (
            <p className="text-center text-xs font-light text-[#B8B8B8]">
              By continuing, you agree to our{" "}
              {legal.terms_url && (
                <a
                  href={legal.terms_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Terms of Service
                </a>
              )}
              {legal.terms_url && legal.privacy_policy_url && " and "}
              {legal.privacy_policy_url && (
                <a
                  href={legal.privacy_policy_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Privacy Policy
                </a>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
