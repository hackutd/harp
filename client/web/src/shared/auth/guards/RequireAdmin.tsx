import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useSessionContext } from "supertokens-auth-react/recipe/session";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
