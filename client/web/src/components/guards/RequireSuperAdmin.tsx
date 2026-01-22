import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { useUserStore } from "@/store";

interface RequireSuperAdminProps {
  children: React.ReactNode;
}

const RequireSuperAdmin = ({ children }: RequireSuperAdminProps) => {
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Final check using user from store (source of truth after API call)
  if (user.role !== "super_admin") {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default RequireSuperAdmin;
