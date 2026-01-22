import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import type { UserRole } from '../types.d';

interface UseSessionRoleResult {
  role: UserRole | null;
  loading: boolean;
  doesSessionExist: boolean;
}

export function useSessionRole(): UseSessionRoleResult {
  const session = useSessionContext();

  if (session.loading) {
    return { role: null, loading: true, doesSessionExist: false };
  }

  if (!session.doesSessionExist) {
    return { role: null, loading: false, doesSessionExist: false };
  }

  const role = session.accessTokenPayload?.role as UserRole | null;
  return { role, loading: false, doesSessionExist: true };
}
