import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { usePermissions } from '@/lib/usePermissions';
import { loginPathFor, defaultPathForUser } from '@/lib/loginRedirect';

export function useProvozAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, canAccessProvoz } = usePermissions();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(loginPathFor(returnTo), { replace: true });
      return;
    }
    if (!canAccessProvoz) {
      navigate(defaultPathForUser(user.role, user.permissions), { replace: true });
    }
  }, [user, isLoading, navigate, location.pathname, location.search, canAccessProvoz]);

  return { me: user ? { user } : undefined, isLoading, allowed: Boolean(user && canAccessProvoz) };
}
