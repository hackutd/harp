import { useState } from "react";
import { Navigate } from "react-router-dom";
import { createCode } from "supertokens-auth-react/recipe/passwordless";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import googleIcon from "@/assets/google_icon.webp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isGoogleAuthEnabled } from "@/shared/auth";
import { checkEmailAuthMethod } from "@/shared/lib/api";

type LoginState = "email" | "sending" | "sent" | "error";

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
                <img src={googleIcon} alt="" className="mr-2 h-4 w-4" />
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
