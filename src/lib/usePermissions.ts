import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  canAccessAdmin,
  canAccessProvoz,
  canAccessUcetni,
  hasPermission,
  type AuthUser,
  type MeResponse,
  type Permission,
} from '@/lib/permissions';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });
}

export function usePermissions() {
  const { data, isLoading } = useMe();
  const user = data?.user ?? null;
  const permissions = user?.permissions ?? [];

  return {
    user,
    isLoading,
    permissions,
    can: (p: Permission) => hasPermission(permissions, p),
    canAccessAdmin: canAccessAdmin(permissions),
    canAccessProvoz: canAccessProvoz(permissions),
    canAccessUcetni: canAccessUcetni(permissions),
  };
}

export type { AuthUser };
