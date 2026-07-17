import { Navigate, useLocation } from 'react-router';
import { usePermissions } from '@/lib/usePermissions';
import { canAccessProvozPath, firstProvozPath } from '@/lib/provozNav';
import { defaultPathForUser } from '@/lib/loginRedirect';

export function ProvozRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isLoading, canAccessProvoz } = usePermissions();

  if (isLoading || !user) {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }

  if (!canAccessProvoz) {
    return <Navigate to={defaultPathForUser(user.role, user.permissions)} replace />;
  }

  if (!canAccessProvozPath(location.pathname, user.permissions)) {
    const fallback = firstProvozPath(user.permissions);
    return <Navigate to={fallback ?? defaultPathForUser(user.role, user.permissions)} replace />;
  }

  return <>{children}</>;
}
