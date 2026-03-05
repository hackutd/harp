import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useSessionContext } from "supertokens-auth-react/recipe/session";

import { Skeleton } from "@/components/ui/skeleton";
import { useUserStore } from "@/shared/stores";

interface RequireAuthProps {
  children: React.ReactNode;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const session = useSessionContext();
  const { user, loading, fetchUser } = useUserStore();
  const fetchInitiated = useRef(false);

  useEffect(() => {
    // Only fetch user if we have a session and haven't initiated fetch yet
    if (
      !session.loading &&
      session.doesSessionExist &&
      !user &&
      !loading &&
      !fetchInitiated.current
    ) {
      fetchInitiated.current = true;
      fetchUser();
    }
  }, [session, user, loading, fetchUser]);

  // Show loading if session is loading or actively fetching user data
  if (session.loading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md space-y-4 p-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-6 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  // No session means not authenticated
  if (!session.doesSessionExist) {
    return <Navigate to="/" replace />;
  }

  // Session exists but no user data - show loading while fetch happens
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md space-y-4 p-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-6 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
