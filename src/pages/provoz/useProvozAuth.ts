import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { loginPathFor } from '@/lib/loginRedirect';

type MeResponse = { user: { id: string; email: string; role: string } | null };

export function useProvozAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });

  useEffect(() => {
    if (isLoading) return;
    if (!me?.user) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(loginPathFor(returnTo), { replace: true });
    }
    else if (me.user.role === 'ucetni') navigate('/ucetni', { replace: true });
  }, [me, isLoading, navigate, location.pathname, location.search]);

  const allowed = Boolean(me?.user && (me.user.role === 'provoz' || me.user.role === 'admin'));
  return { me, isLoading, allowed };
}
