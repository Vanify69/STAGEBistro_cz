import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import type { Permission } from '@/lib/permissions';

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'provoz' | 'ucetni';
  isActive: boolean;
  lastLoginAt: string | null;
  permissions: Permission[] | null;
  effectivePermissions: Permission[];
  createdAt: string;
};

type PermissionsMeta = {
  permissions: { id: Permission; label: string }[];
  roleTemplates: Record<string, Permission[]>;
  presets: { id: string; label: string; permissions: Permission[] }[];
};

export function UsersAdminTab() {
  const qc = useQueryClient();
  const metaQ = useQuery({
    queryKey: ['admin', 'permissions-meta'],
    queryFn: () => apiFetch<PermissionsMeta>('/api/admin/permissions'),
  });
  const usersQ = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'provoz' as 'admin' | 'provoz' | 'ucetni',
    isActive: true,
    useCustomPermissions: false,
    permissions: [] as Permission[],
  });

  const resetForm = () => {
    setForm({
      email: '',
      password: '',
      displayName: '',
      role: 'provoz',
      isActive: true,
      useCustomPermissions: false,
      permissions: [],
    });
    setCreating(false);
    setEditingId(null);
  };

  const startEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setCreating(false);
    setForm({
      email: u.email,
      password: '',
      displayName: u.displayName ?? '',
      role: u.role,
      isActive: u.isActive,
      useCustomPermissions: u.permissions != null,
      permissions: u.permissions ?? [...u.effectivePermissions],
    });
  };

  const applyPreset = (perms: Permission[]) => {
    setForm((f) => ({ ...f, useCustomPermissions: true, permissions: [...perms] }));
  };

  const togglePermission = (p: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        email: form.email,
        displayName: form.displayName || null,
        role: form.role,
        isActive: form.isActive,
        permissions: form.useCustomPermissions ? form.permissions : null,
        ...(form.password ? { password: form.password } : {}),
      };
      if (creating) {
        if (!form.password || form.password.length < 8) {
          throw new Error('Heslo musí mít alespoň 8 znaků');
        }
        return apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({ ...body, password: form.password }),
        });
      }
      return apiFetch(`/api/admin/users/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      resetForm();
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const permissions = metaQ.data?.permissions ?? [];

  return (
    <div className="space-y-6 mt-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-black/60">
          Vytvářejte účty bez Railway. Vlastní oprávnění přepíší výchozí šablonu role.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            resetForm();
            setCreating(true);
          }}
        >
          Nový uživatel
        </Button>
      </div>

      {(creating || editingId) && (
        <div className="border border-black/10 rounded p-4 space-y-3 bg-black/[0.02]">
          <h3 className="font-medium">{creating ? 'Nový uživatel' : 'Upravit uživatele'}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Jméno (volitelné)</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div>
              <Label>{creating ? 'Heslo' : 'Nové heslo (volitelné)'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <Label>Role (šablona)</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as typeof f.role }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — plný přístup</SelectItem>
                  <SelectItem value="provoz">Provoz — personál a tržby</SelectItem>
                  <SelectItem value="ucetni">Účetní</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Účet aktivní
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.useCustomPermissions}
              onChange={(e) => setForm((f) => ({ ...f, useCustomPermissions: e.target.checked }))}
            />
            Vlastní oprávnění (jinak platí šablona role)
          </label>
          {form.useCustomPermissions && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(metaQ.data?.presets ?? []).map((preset) => (
                  <Button key={preset.id} type="button" size="sm" variant="secondary" onClick={() => applyPreset(preset.permissions)}>
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-1 sm:grid-cols-2 text-sm max-h-48 overflow-auto border border-black/10 rounded p-2">
                {permissions.map((p) => (
                  <label key={p.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={form.permissions.includes(p.id)}
                      onChange={() => togglePermission(p.id)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Ukládám…' : 'Uložit'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Zrušit
            </Button>
          </div>
        </div>
      )}

      <div className="border border-black/10 rounded divide-y text-sm">
        {(usersQ.data?.users ?? []).map((u) => (
          <div key={u.id} className="p-3 flex flex-wrap justify-between gap-2 items-start">
            <div>
              <p className="font-medium">
                {u.displayName ? `${u.displayName} · ` : ''}
                {u.email}
                {!u.isActive && <span className="text-red-600 ml-2">(neaktivní)</span>}
              </p>
              <p className="text-black/60 text-xs mt-1">
                Role: {u.role}
                {u.permissions ? ' · vlastní oprávnění' : ' · šablona role'}
                {u.lastLoginAt && ` · poslední přihlášení ${new Date(u.lastLoginAt).toLocaleString('cs-CZ')}`}
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => startEdit(u)}>
              Upravit
            </Button>
          </div>
        ))}
        {usersQ.isLoading && <p className="p-3 text-black/50">Načítání…</p>}
      </div>
    </div>
  );
}
