import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { defaultPathForUser, safeNextPath } from '@/lib/loginRedirect';
import type { MeResponse } from '@/lib/permissions';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const nextPath = safeNextPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });

  useEffect(() => {
    if (!me?.user) return;
    navigate(nextPath ?? defaultPathForUser(me.user.role, me.user.permissions), { replace: true });
  }, [me, navigate, nextPath]);

  const login = useMutation({
    mutationFn: async () => {
      return apiFetch<MeResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate(nextPath ?? defaultPathForUser(res.user.role, res.user.permissions), { replace: true });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form
        className="w-full max-w-sm space-y-4 border border-black/10 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <h1 className="text-xl font-medium tracking-tight">Přihlášení</h1>
        {nextPath && (
          <p className="text-sm text-black/60">Po přihlášení budete přesměrováni na požadovanou stránku.</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Heslo</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {login.isError && <p className="text-sm text-red-600">{(login.error as Error).message}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? '…' : 'Přihlásit'}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/')}>
          Zpět na web
        </Button>
      </form>
    </div>
  );
}
