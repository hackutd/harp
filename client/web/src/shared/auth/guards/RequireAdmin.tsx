import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useSessionContext } from "supertokens-auth-react/recipe/session";

import { Skeleton } from "@/components/ui/skeleton";
import { useUserStore } from "@/shared/stores";

interface RequireAdminProps {
  children: React.ReactNode;
}

export default function RequireAdmin({ children }: RequireAdminProps) {
  const session = useSessionContext();
  const { user, loading, fetchUser } = useUserStore();
  const fetchInitiated = useRef(false);

  useEffect(() => {
    // Only fetch user if we have a session and haven't started fetch yet
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

  // session loading or fetching user data
  if (session.loading || loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-56 border-r p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // No session
  if (!session.doesSessionExist) {
    return <Navigate to="/" replace />;
  }

  // Session exists but no user data - show loading while fetch happens
  if (!user) {
    return (
      <div className="flex min-h-screen">
        <div className="w-56 border-r p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Final check using user from store
  if (user.role !== "admin" && user.role !== "super_admin") {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
