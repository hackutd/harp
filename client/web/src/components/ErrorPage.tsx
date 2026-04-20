import { ArrowLeft, Home } from "lucide-react";
import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from "react-router-dom";

import { Button } from "@/components/ui/button";

type ErrorCopy = {
  status: string;
  title: string;
  message: string;
};

function describeError(error: unknown): ErrorCopy {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        status: "404",
        title: "Page not found",
        message: "The page you're looking for doesn't exist or may have moved.",
      };
    }
    if (error.status === 401) {
      return {
        status: "401",
        title: "Not signed in",
        message: "You need to sign in to view this page.",
      };
    }
    if (error.status === 403) {
      return {
        status: "403",
        title: "Access denied",
        message: "You don't have permission to access this page.",
      };
    }
    return {
      status: String(error.status),
      title: error.statusText || "Something went wrong",
      message:
        "An unexpected error occurred while loading this page. Please try again.",
    };
  }

  return {
    status: "500",
    title: "uh oh...",
    message:
      error instanceof Error && error.message
        ? error.message
        : "An unexpected error occurred. Please try again, or head back home.",
  };
}

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { status, title, message } = describeError(error);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-3">
            <p className="font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Error {status}
            </p>
            <h1 className="text-2xl font-medium tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="text-muted-foreground text-balance text-sm">
              {message}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto cursor-pointer"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Go back
            </Button>
            <Button
              className="w-full sm:w-auto cursor-pointer"
              onClick={() => navigate("/")}
            >
              <Home className="mr-1.5 h-4 w-4" />
              Go home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
