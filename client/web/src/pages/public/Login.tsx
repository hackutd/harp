import { useState } from "react";
import { createCode } from "supertokens-auth-react/recipe/passwordless";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isGoogleAuthEnabled } from "@/lib/supertokens";
import { checkEmailAuthMethod } from "@/lib/api";

type LoginState = "email" | "sending" | "sent" | "error";

// Google logo SVG component (lucide-react doesn't include brand icons)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
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
          "This email is registered with Google. Please use the Google sign-in option instead."
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
            "This email is registered with magic link sign-in. Please use the email option instead."
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
        err instanceof Error ? err.message : "Failed to initiate Google login"
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
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
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
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We've sent a magic link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Click the link in the email to sign in to your account. The link
              will expire in 15 minutes.
            </p>
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleReset}
              >
                Use a different email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Email input form
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to HackUTD
          </h1>
          <p className="text-gray-600 mt-2">
            Sign in or create an account to continue
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Choose your preferred sign in method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "error" && error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Google OAuth Button (only if enabled) */}
            {isGoogleAuthEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                >
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  Continue with Google
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>
              </>
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

            <p className="text-xs text-center text-gray-500 mt-4">
              By continuing, you agree to HackUTD's Terms of Service and Privacy
              Policy
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
