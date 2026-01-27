import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInAndUp } from "supertokens-auth-react/recipe/thirdparty";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AuthOAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const response = await signInAndUp();

        if (response.status === "OK") {
          // Successfully signed in, redirect to auth callback to complete flow
          navigate("/auth/callback");
        } else if (response.status === "NO_EMAIL_GIVEN_BY_PROVIDER") {
          setError(
            "Google did not provide an email address. Please try again or use the magic link option."
          );
        } else {
          setError("Sign in not allowed. Please contact support.");
        }
      } catch (err) {
        // SuperTokens throws Response objects when backend returns an error
        if (err instanceof Response) {
          try {
            const body = await err.json();
            const message = body?.message || body?.error || "";
            if (
              message.toLowerCase().includes("auth method mismatch") ||
              message.toLowerCase().includes("passwordless") ||
              message.toLowerCase().includes("magic link")
            ) {
              setError(
                "This email is already registered with magic link sign-in. Please go back and use the email option instead."
              );
              return;
            }
          } catch {
            // Failed to parse response body
          }
          // Check if it's a 500 error (likely our auth method check failed)
          if (err.status === 500) {
            setError(
              "This email may already be registered with a different sign-in method. Please try using the magic link option instead."
            );
            return;
          }
        }

        const message = err instanceof Error ? err.message : "";
        if (
          message.toLowerCase().includes("auth method mismatch") ||
          message.toLowerCase().includes("passwordless")
        ) {
          setError(
            "This email is already registered with magic link sign-in. Please go back and use the email option instead."
          );
        } else {
          setError(message || "An error occurred during sign in");
        }
      }
    }

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
