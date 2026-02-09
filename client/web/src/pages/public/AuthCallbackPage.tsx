import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Session, { signOut } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isGoogleAuthEnabled } from "@/shared/auth";
import { useUserStore } from "@/shared/stores";

export default function AuthCallback() {
  const fetchUser = useUserStore((state) => state.fetchUser);
  const authError = useUserStore((state) => state.authError);
  const clearAuthError = useUserStore((state) => state.clearAuthError);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {

    const handleCallback = async () => {
      const sessionExists = await Session.doesSessionExist();
      
      if (sessionExists) {
        await fetchUser();

        const { user, authError: error } = useUserStore.getState();

        if (user) {
          // Redirect based on role
          if (user.role === "admin" || user.role === "super_admin") {
            navigate("/admin/all-applicants", { replace: true });
          } else {
            navigate("/app", { replace: true });
          }
        } else if (error && error.status === 409) {
          await signOut();
          setIsLoading(false);
        } else {
          navigate("/", { replace: true });
        }
      } else {
        navigate("/", { replace: true });
      }
    };

    handleCallback();
  }, [fetchUser, navigate]);

  const handleGoToLogin = () => {
    clearAuthError();
    navigate("/", { replace: true });
  };

  const handleGoogleLogin = async () => {
    clearAuthError();
    try {
      await redirectToThirdPartyLogin({ thirdPartyId: "google" });
    } catch {
      // If redirect fails, just go to login page
      navigate("/", { replace: true });
    }
  };

  // Show auth method mismatch error
  if (!isLoading && authError && authError.status === 409) {
    const isGoogleRequired = authError.message.includes("Google");

    return (
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <CardTitle>Different Sign-In Method Required</CardTitle>
            <CardDescription>
              This email is already registered with a different sign-in method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{authError.message}</AlertDescription>
            </Alert>

            <div className="space-y-2 pt-2">
              {isGoogleRequired && isGoogleAuthEnabled ? (
                <Button className="w-full" onClick={handleGoogleLogin}>
                  Continue with Google
                </Button>
              ) : (
                <Button className="w-full" onClick={handleGoToLogin}>
                  Sign in with Magic Link
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoToLogin}
              >
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
