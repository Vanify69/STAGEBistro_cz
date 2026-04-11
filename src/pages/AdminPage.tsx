import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Textarea } from '@/app/components/ui/textarea';

type MeResponse = { user: { id: string; email: string; role: string } | null };

export default function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });

  useEffect(() => {
    if (meLoading) return;
    if (!me?.user) {
      navigate('/login', { replace: true });
      return;
    }
    if (me.user.role !== 'admin') {
      navigate(me.user.role === 'provoz' ? '/provoz' : '/ucetni', { replace: true });
    }
  }, [me, meLoading, navigate]);

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
    enabled: me?.user?.role === 'admin',
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
    enabled: me?.user?.role === 'admin',
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

  const menuQuery = useQuery({
    queryKey: ['admin', 'menu'],
    queryFn: async () => {
      const [cats, its] = await Promise.all([
        apiFetch<{ categories: { id: string; slug: string; nameCz: string; nameEn: string }[] }>('/api/admin/menu/categories'),
        apiFetch<{ items: { id: string; categoryId: string; nameCz: string; priceCents: number }[] }>('/api/admin/menu/items'),
      ]);
      return { categories: cats.categories, items: its.items };
    },
    enabled: me?.user?.role === 'admin',
  });

  const galleryQuery = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: () => apiFetch<{ images: { id: string; url: string }[] }>('/api/admin/gallery'),
    enabled: me?.user?.role === 'admin',
  });

  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const addGallery = useMutation({
    mutationFn: () => apiFetch('/api/admin/gallery', { method: 'POST', body: JSON.stringify({ url: newGalleryUrl }) }),
    onSuccess: () => {
      setNewGalleryUrl('');
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
    },
  });

  if (meLoading || !me?.user || me.user.role !== 'admin') {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-tight">Administrace</h1>
        <div className="flex gap-2">
          <Button variant="outline" type="button" onClick={() => navigate('/')}>
            Web
          </Button>
          <Button variant="outline" type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Odhlásit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="settings">Nastavení</TabsTrigger>
          <TabsTrigger value="events">Akce v hlavičce</TabsTrigger>
          <TabsTrigger value="menu">Menu (přehled)</TabsTrigger>
          <TabsTrigger value="gallery">Galerie</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <p className="text-sm text-black/60">
            JSON mapa klíčů (např. tagline.cz, map.embedUrl). Uložením přepíšete hodnoty v databázi. U klíče{' '}
            <code className="text-xs bg-black/5 px-1">map.embedUrl</code> můžete vložit buď jen URL z Google Maps (embed), nebo celý kód{' '}
            <code className="text-xs bg-black/5 px-1">&lt;iframe …&gt;</code> — server si z něj URL sám vytáhne.
          </p>
          <Textarea value={settingsJson} onChange={(e) => setSettingsJson(e.target.value)} rows={18} className="font-mono text-sm" />
          {saveSettings.isError && <p className="text-sm text-red-600">{(saveSettings.error as Error).message}</p>}
          <Button type="button" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            Uložit nastavení
          </Button>
        </TabsContent>

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
          <p className="text-sm text-black/60">
            Seznam zobrazuje jen akce v zvoleném kalendářním měsíci (od 1. do posledního dne). Např. harmonogram „Střelák –
            květen 2026“ je pod měsícem <strong>2026-05</strong>; jediný dubnový řádek (30. 4.) je pod <strong>2026-04</strong>.
          </p>
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

        <TabsContent value="menu" className="mt-4 text-sm space-y-2">
          <p className="text-black/60">Úpravy položek a kategorií přes REST API (viz README). Přehled:</p>
          <div className="border border-black/10 rounded-md p-3 max-h-96 overflow-auto font-mono">
            {(menuQuery.data?.categories ?? []).map((c) => (
              <div key={c.id} className="mb-2">
                <strong>{c.slug}</strong> — {c.nameCz}
                <ul className="ml-4 list-disc">
                  {(menuQuery.data?.items ?? [])
                    .filter((i) => i.categoryId === c.id)
                    .map((i) => (
                      <li key={i.id}>
                        {i.nameCz} ({Math.round(i.priceCents / 100)} Kč)
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>

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
      </Tabs>
    </div>
  );
}
