import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

type MeResponse = { user: { id: string; email: string; role: string } | null };

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });

  useEffect(() => {
    if (!me?.user) return;
    const r = me.user.role;
    if (r === 'admin') navigate('/admin', { replace: true });
    else if (r === 'provoz') navigate('/provoz', { replace: true });
    else navigate('/ucetni', { replace: true });
  }, [me, navigate]);

  const login = useMutation({
    mutationFn: async () => {
      return apiFetch<{ user: { role: string } }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      const r = res.user.role;
      if (r === 'admin') navigate('/admin', { replace: true });
      else if (r === 'provoz') navigate('/provoz', { replace: true });
      else navigate('/ucetni', { replace: true });
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
