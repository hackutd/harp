import { useEffect, useRef } from "react";
import { Navigate } from "react-router";
import { useSessionContext } from "supertokens-auth-react/recipe/session";

import { HackerPageLoader } from "@/components/HackerPageLoader";
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
    return <HackerPageLoader fullscreen />;
  }

  // No session means not authenticated
  if (!session.doesSessionExist) {
    return <Navigate to="/" replace />;
  }

  // Session exists but no user data - show loading while fetch happens
  if (!user) {
    return <HackerPageLoader fullscreen />;
  }

  return <>{children}</>;
};

export default RequireAuth;
