import { Navigate } from 'react-router';
import { usePermissions } from '@/lib/usePermissions';
import { firstProvozPath } from '@/lib/provozNav';
import { defaultPathForUser } from '@/lib/loginRedirect';

export default function ProvozIndexRedirect() {
  const { user, isLoading, canAccessProvoz } = usePermissions();
  if (isLoading || !user) {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }
  if (!canAccessProvoz) {
    return <Navigate to={defaultPathForUser(user.role, user.permissions)} replace />;
  }
  const first = firstProvozPath(user.permissions);
  if (!first) {
    return <Navigate to={defaultPathForUser(user.role, user.permissions)} replace />;
  }
  return <Navigate to={first.replace('/provoz/', '')} replace />;
}
