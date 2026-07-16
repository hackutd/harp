import { useState } from "react";
import { Navigate } from "react-router-dom";
import { createCode } from "supertokens-auth-react/recipe/passwordless";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isGoogleAuthEnabled } from "@/shared/auth";
import { checkEmailAuthMethod } from "@/shared/lib/api";

type LoginState = "email" | "sending" | "sent" | "error";

// Google logo SVG component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        d="M22.36 10H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53h-.013l.013-.01c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09c.87-2.6 3.3-4.53 6.16-4.53 1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07 1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93v.01C3.99 20.53 7.7 23 12 23c2.97 0 5.46-.98 7.28-2.66 2.08-1.92 3.28-4.74 3.28-8.09 0-.78-.07-1.53-.2-2.25z"
        fill="#4285F4"
      />
      <path
        d="M2.18 7.07C3.99 3.47 7.7 1 12 1c2.97 0 5.45 1.09 7.36 2.87l-3.15 3.15A6.6 6.6 0 0 0 12 5.38c-2.86 0-5.29 1.93-6.16 4.53z"
        fill="#EA4335"
      />
      <path
        d="M2.18 7.07 5.84 9.9c-.22.66-.35 1.37-.35 2.1s.13 1.43.35 2.09l-3.66 2.84C1.43 15.45 1 13.78 1 12s.43-3.45 1.18-4.93z"
        fill="#FBBC05"
      />
      <path
        d="M5.84 14.09c.87 2.6 3.3 4.53 6.16 4.53 1.48 0 2.73-.4 3.71-1.06l3.57 2.78C17.46 22.02 14.97 23 12 23c-4.3 0-8.01-2.47-9.82-6.06z"
        fill="#34A853"
      />
    </svg>
  );
}

export default function Login() {
  const session = useSessionContext();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("email");
  const [error, setError] = useState("");

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
          <h1 className="text-4xl font-semibold tracking-tight text-black">
            HARP
          </h1>
          <p className="mt-2 text-sm font-light text-[#8A8A8A]">
            Sign in to continue
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
            <input
              id="email"
              type="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={state === "sending"}
              className="h-11 w-full border-b border-[#E5E5E5] bg-transparent text-sm font-light text-black placeholder:text-[#B8B8B8] focus:border-black focus:outline-none"
            />
            <Button
              type="submit"
              className="h-12 w-full rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
              disabled={state === "sending" || !email}
            >
              {state === "sending" ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Sending magic link...
                </span>
              ) : (
                "Send magic link"
              )}
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
                <GoogleIcon className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>
            </>
          )}

          <p className="text-center text-xs font-light text-[#B8B8B8]">
            By continuing, you agree to HackUTD's Terms of Service and Privacy
            Policy
          </p>
        </div>
      </div>
    </div>
  );
}
