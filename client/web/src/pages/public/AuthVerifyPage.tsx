import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { consumeCode } from "supertokens-auth-react/recipe/passwordless";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VerifyStatus = "verifying" | "success" | "expired" | "invalid" | "error";

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

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">Verifying your magic link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <CardTitle>
            {status === "expired" && "Link Expired"}
            {status === "invalid" && "Invalid Link"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => navigate("/")}>
            Request new magic link
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Back to home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
