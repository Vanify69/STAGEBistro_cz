import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Textarea } from '@/app/components/ui/textarea';
import { MenuAdminTab } from '@/pages/admin/MenuAdminTab';
import { UsersAdminTab } from '@/pages/admin/UsersAdminTab';
import { AuditAdminTab } from '@/pages/admin/AuditAdminTab';
import { usePermissions } from '@/lib/usePermissions';
import { defaultPathForUser } from '@/lib/loginRedirect';

export default function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoading, can, canAccessAdmin, canAccessProvoz, canAccessUcetni } = usePermissions();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (!canAccessAdmin) {
      navigate(defaultPathForUser(user.role, user.permissions), { replace: true });
    }
  }, [user, isLoading, navigate, canAccessAdmin]);

  const defaultTab = useMemo(() => {
    if (can('site.settings')) return 'settings';
    if (can('site.events')) return 'events';
    if (can('site.menu')) return 'menu';
    if (can('site.gallery')) return 'gallery';
    if (can('users.manage')) return 'users';
    if (can('audit.read')) return 'audit';
    return 'settings';
  }, [can]);

  const [tab, setTab] = useState(defaultTab);
  useEffect(() => setTab(defaultTab), [defaultTab]);

  const logout = useMutation({
    mutationFn: () => apiFetch('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/login', { replace: true });
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiFetch<{ settings: Record<string, unknown> }>('/api/admin/settings'),
    enabled: can('site.settings'),
  });

  const [settingsJson, setSettingsJson] = useState('');
  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsJson(JSON.stringify(settingsQuery.data.settings, null, 2));
    }
  }, [settingsQuery.data]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const parsed = JSON.parse(settingsJson) as Record<string, unknown>;
      return apiFetch('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ settings: parsed }) });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['public', 'site'] });
    },
  });

  const [monthKey, setMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const eventsQuery = useQuery({
    queryKey: ['admin', 'header-events', monthKey],
    queryFn: () => apiFetch<{ events: unknown[] }>('/api/admin/header-events?month=' + monthKey),
    enabled: can('site.events'),
  });

  const [evForm, setEvForm] = useState({
    eventDate: '',
    timeText: '',
    titleCz: '',
    titleEn: '',
    subtitleCz: '',
    subtitleEn: '',
    linkUrl: '',
  });

  const createEvent = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/header-events', {
        method: 'POST',
        body: JSON.stringify({
          eventDate: evForm.eventDate,
          timeText: evForm.timeText || null,
          titleCz: evForm.titleCz,
          titleEn: evForm.titleEn,
          subtitleCz: evForm.subtitleCz,
          subtitleEn: evForm.subtitleEn,
          linkUrl: evForm.linkUrl || null,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'header-events'] }),
  });

  const galleryQuery = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: () => apiFetch<{ images: { id: string; url: string }[] }>('/api/admin/gallery'),
    enabled: can('site.gallery'),
  });

  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const addGallery = useMutation({
    mutationFn: () => apiFetch('/api/admin/gallery', { method: 'POST', body: JSON.stringify({ url: newGalleryUrl }) }),
    onSuccess: () => {
      setNewGalleryUrl('');
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
    },
  });

  if (isLoading || !user || !canAccessAdmin) {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl tracking-tight">Administrace</h1>
          <p className="text-sm text-black/50">{user.displayName ?? user.email}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" type="button" onClick={() => navigate('/')}>
            Web
          </Button>
          {canAccessProvoz && (
            <Button variant="outline" type="button" onClick={() => navigate('/provoz')}>
              Provoz
            </Button>
          )}
          {canAccessUcetni && (
            <Button variant="outline" type="button" onClick={() => navigate('/ucetni')}>
              Účetní
            </Button>
          )}
          <Button variant="outline" type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Odhlásit
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          {can('site.settings') && <TabsTrigger value="settings">Nastavení</TabsTrigger>}
          {can('site.events') && <TabsTrigger value="events">Akce v hlavičce</TabsTrigger>}
          {can('site.menu') && <TabsTrigger value="menu">Menu</TabsTrigger>}
          {can('site.gallery') && <TabsTrigger value="gallery">Galerie</TabsTrigger>}
          {can('users.manage') && <TabsTrigger value="users">Uživatelé</TabsTrigger>}
          {can('audit.read') && <TabsTrigger value="audit">Historie</TabsTrigger>}
        </TabsList>

        {can('site.settings') && (
          <TabsContent value="settings" className="space-y-4 mt-4">
            <p className="text-sm text-black/60">
              JSON mapa klíčů (např. tagline.cz, map.embedUrl). Uložením přepíšete hodnoty v databázi.
            </p>
            <Textarea value={settingsJson} onChange={(e) => setSettingsJson(e.target.value)} rows={18} className="font-mono text-sm" />
            {saveSettings.isError && <p className="text-sm text-red-600">{(saveSettings.error as Error).message}</p>}
            <Button type="button" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              Uložit nastavení
            </Button>
          </TabsContent>
        )}

        {can('site.events') && (
          <TabsContent value="events" className="space-y-4 mt-4">
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <Label>Měsíc (YYYY-MM)</Label>
                <Input value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="w-40" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'header-events', monthKey] })}
              >
                Obnovit
              </Button>
            </div>
            <div className="border border-black/10 rounded-md divide-y max-h-[28rem] overflow-auto text-sm">
              {(eventsQuery.data?.events ?? []).map((e: { id: string; eventDate: string; titleCz: string }) => (
                <div key={e.id} className="p-2 flex justify-between gap-2">
                  <span>
                    {e.eventDate} — {e.titleCz}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() =>
                      apiFetch(`/api/admin/header-events/${e.id}`, { method: 'DELETE' }).then(() =>
                        qc.invalidateQueries({ queryKey: ['admin', 'header-events', monthKey] })
                      )
                    }
                  >
                    Smazat
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Datum (YYYY-MM-DD)</Label>
                <Input value={evForm.eventDate} onChange={(e) => setEvForm((s) => ({ ...s, eventDate: e.target.value }))} />
              </div>
              <div>
                <Label>Čas (text)</Label>
                <Input value={evForm.timeText} onChange={(e) => setEvForm((s) => ({ ...s, timeText: e.target.value }))} />
              </div>
              <div>
                <Label>Titulek CZ</Label>
                <Input value={evForm.titleCz} onChange={(e) => setEvForm((s) => ({ ...s, titleCz: e.target.value }))} />
              </div>
              <div>
                <Label>Titulek EN</Label>
                <Input value={evForm.titleEn} onChange={(e) => setEvForm((s) => ({ ...s, titleEn: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Podtitulek CZ</Label>
                <Input value={evForm.subtitleCz} onChange={(e) => setEvForm((s) => ({ ...s, subtitleCz: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Podtitulek EN</Label>
                <Input value={evForm.subtitleEn} onChange={(e) => setEvForm((s) => ({ ...s, subtitleEn: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Odkaz (volitelné)</Label>
                <Input value={evForm.linkUrl} onChange={(e) => setEvForm((s) => ({ ...s, linkUrl: e.target.value }))} />
              </div>
            </div>
            <Button type="button" onClick={() => createEvent.mutate()} disabled={createEvent.isPending}>
              Přidat akci
            </Button>
          </TabsContent>
        )}

        {can('site.menu') && (
          <TabsContent value="menu">
            <MenuAdminTab />
          </TabsContent>
        )}

        {can('site.gallery') && (
          <TabsContent value="gallery" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input placeholder="URL obrázku" value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} />
              <Button type="button" onClick={() => addGallery.mutate()} disabled={!newGalleryUrl || addGallery.isPending}>
                Přidat
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(galleryQuery.data?.images ?? []).map((img) => (
                <div key={img.id} className="flex gap-2 items-center border border-black/10 p-2">
                  <img src={img.url} alt="" className="w-16 h-16 object-cover" />
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() =>
                      apiFetch(`/api/admin/gallery/${img.id}`, { method: 'DELETE' }).then(() =>
                        qc.invalidateQueries({ queryKey: ['admin', 'gallery'] })
                      )
                    }
                  >
                    Smazat
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        {can('users.manage') && (
          <TabsContent value="users">
            <UsersAdminTab />
          </TabsContent>
        )}

        {can('audit.read') && (
          <TabsContent value="audit">
            <AuditAdminTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
