import { useState } from "react";
import { Navigate } from "react-router-dom";
import { createCode } from "supertokens-auth-react/recipe/passwordless";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import logoImage from "@/assets/logo.webp";
import signinImage from "@/assets/signin.webp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <defs>
        <radialGradient
          id="prefix__b"
          cx="1.479"
          cy="12.788"
          fx="1.479"
          fy="12.788"
          r="9.655"
          gradientTransform="matrix(.8032 0 0 1.0842 2.459 -.293)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".368" stopColor="#ffcf09" />
          <stop offset=".718" stopColor="#ffcf09" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffcf09" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id="prefix__c"
          cx="14.295"
          cy="23.291"
          fx="14.295"
          fy="23.291"
          r="11.878"
          gradientTransform="matrix(1.3272 0 0 1.0073 -3.434 -.672)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".383" stopColor="#34a853" />
          <stop offset=".706" stopColor="#34a853" stopOpacity=".7" />
          <stop offset="1" stopColor="#34a853" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id="prefix__d"
          x1="23.558"
          y1="6.286"
          x2="12.148"
          y2="20.299"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".671" stopColor="#4285f4" />
          <stop offset=".885" stopColor="#4285f4" stopOpacity="0" />
        </linearGradient>
        <clipPath id="prefix__a">
          <path
            d="M22.36 10H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53h-.013l.013-.01c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09c.87-2.6 3.3-4.53 6.16-4.53 1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07 1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93v.01C3.99 20.53 7.7 23 12 23c2.97 0 5.46-.98 7.28-2.66 2.08-1.92 3.28-4.74 3.28-8.09 0-.78-.07-1.53-.2-2.25z"
            fill="none"
          />
        </clipPath>
      </defs>
      <path
        d="M22.36 10H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53h-.013l.013-.01c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09c.87-2.6 3.3-4.53 6.16-4.53 1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07 1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93v.01C3.99 20.53 7.7 23 12 23c2.97 0 5.46-.98 7.28-2.66 2.08-1.92 3.28-4.74 3.28-8.09 0-.78-.07-1.53-.2-2.25z"
        fill="#fc4c53"
      />
      <g clipPath="url(#prefix__a)">
        <ellipse
          cx="3.646"
          cy="13.572"
          rx="7.755"
          ry="10.469"
          fill="url(#prefix__b)"
        />
        <ellipse
          cx="15.538"
          cy="22.789"
          rx="15.765"
          ry="11.965"
          transform="rotate(-7.12 15.539 22.789)"
          fill="url(#prefix__c)"
        />
        <path
          fill="url(#prefix__d)"
          d="M11.105 8.28l.491 5.596.623 3.747 7.362 6.848 8.607-15.897-17.083-.294z"
        />
      </g>
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
      // auth_method is "passwordless" - proceed normally
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
    // If user entered email, check it first
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
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-center md:justify-start">
            <img
              src={logoImage}
              alt="HackUTD"
              className="h-12 w-auto hover:animate-spin cursor-pointer"
            />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs space-y-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">Check your email</h1>
                  <p className="text-muted-foreground text-sm">
                    We've sent a magic link to <strong>{email}</strong>
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Click the link in the email to sign in to your account. The link
                will expire in 15 minutes.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleReset}
              >
                Use a different email
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <img
            src={signinImage}
            alt="Hackathon event"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
    );
  }

  // Email input form
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <img
            src={logoImage}
            alt="HackUTD"
            className="h-12 w-auto hover:animate-spin cursor-pointer"
          />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs space-y-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">(DEV)</h1>
              <h1 className="text-2xl font-bold">Login or create an account</h1>
              <p className="text-muted-foreground text-sm text-balance">
                Enter your email to login or create an account
              </p>
            </div>

            <div className="space-y-4">
              {state === "error" && error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Magic Link Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={state === "sending"}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={state === "sending" || !email}
                >
                  {state === "sending" ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleLogin}
                  >
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    Login with Google
                  </Button>
                </>
              )}

              <p className="text-xs text-center text-muted-foreground">
                By continuing, you agree to HackUTD's Terms of Service and
                Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={signinImage}
          alt="Hackathon event"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
