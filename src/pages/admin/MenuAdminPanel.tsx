import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getMenuCategoryIcon, MENU_ICON_KEYS, type MenuIconKey } from '@/lib/menuIcons';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import type { AdminMenuCategory, AdminMenuItem } from './menuAdminTypes';
import {
  emptyCategory,
  emptyItem,
  formatKc,
  IconPicker,
  ImageUrlField,
  invalidateMenu,
  parseKcToCents,
  slugify,
  type CategoryFormState,
  type ItemFormState,
} from './menuAdminShared';

export function MenuAdminPanel() {
  const qc = useQueryClient();

  const menuQuery = useQuery({
    queryKey: ['admin', 'menu'],
    queryFn: async () => {
      const [cats, its] = await Promise.all([
        apiFetch<{ categories: AdminMenuCategory[] }>('/api/admin/menu/categories'),
        apiFetch<{ items: AdminMenuItem[] }>('/api/admin/menu/items'),
      ]);
      return { categories: cats.categories, items: its.items };
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiFetch<{ settings: Record<string, unknown> }>('/api/admin/settings'),
  });

  const heroFromSettings =
    typeof settingsQuery.data?.settings['menu.heroImageUrl'] === 'string'
      ? settingsQuery.data.settings['menu.heroImageUrl']
      : '';

  const [heroDraft, setHeroDraft] = useState('');
  const [heroTouched, setHeroTouched] = useState(false);

  useEffect(() => {
    if (!heroTouched && settingsQuery.data) {
      setHeroDraft(heroFromSettings);
    }
  }, [heroFromSettings, heroTouched, settingsQuery.data]);

  const categories = useMemo(
    () => [...(menuQuery.data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [menuQuery.data?.categories]
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, AdminMenuItem[]>();
    for (const item of menuQuery.data?.items ?? []) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [menuQuery.data?.items]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [catDialog, setCatDialog] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null);
  const [catForm, setCatForm] = useState<CategoryFormState>(emptyCategory());
  const [itemDialog, setItemDialog] = useState<{ mode: 'create'; categoryId: string } | { mode: 'edit'; id: string } | null>(
    null
  );
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItem(''));
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'item'; id: string; label: string } | null>(null);

  const saveHero = useMutation({
    mutationFn: async (url: string) =>
      apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings: { 'menu.heroImageUrl': url || null } }),
      }),
    onSuccess: () => {
      setHeroTouched(false);
      invalidateMenu(qc);
    },
  });

  const toggleItemActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/api/admin/menu/items/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    onSuccess: () => invalidateMenu(qc),
  });

  const toggleCatActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/api/admin/menu/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    onSuccess: () => invalidateMenu(qc),
  });

  const saveCategory = useMutation({
    mutationFn: async () => {
      const body = {
        slug: catForm.slug.trim(),
        nameCz: catForm.nameCz.trim(),
        nameEn: catForm.nameEn.trim(),
        iconKey: catForm.iconKey,
        imageUrl: catForm.imageUrl.trim() || null,
        active: catForm.active,
      };
      if (catDialog?.mode === 'create') {
        const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), -1);
        return apiFetch('/api/admin/menu/categories', {
          method: 'POST',
          body: JSON.stringify({ ...body, sortOrder: maxOrder + 1 }),
        });
      }
      return apiFetch(`/api/admin/menu/categories/${catDialog!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setCatDialog(null);
      invalidateMenu(qc);
    },
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      const body = {
        categoryId: itemForm.categoryId,
        nameCz: itemForm.nameCz.trim(),
        nameEn: itemForm.nameEn.trim(),
        descCz: itemForm.descCz.trim() || null,
        descEn: itemForm.descEn.trim() || null,
        priceCents: parseKcToCents(itemForm.priceKc),
        allergenCodes: itemForm.allergenCodes.trim() || null,
        imageUrl: itemForm.imageUrl.trim() || null,
        active: itemForm.active,
      };
      if (itemDialog?.mode === 'create') {
        const catItems = itemsByCategory.get(itemForm.categoryId) ?? [];
        const maxOrder = catItems.reduce((m, i) => Math.max(m, i.sortOrder), -1);
        return apiFetch('/api/admin/menu/items', {
          method: 'POST',
          body: JSON.stringify({ ...body, sortOrder: maxOrder + 1 }),
        });
      }
      return apiFetch(`/api/admin/menu/items/${itemDialog!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setItemDialog(null);
      invalidateMenu(qc);
    },
  });

  const deleteEntity = useMutation({
    mutationFn: async (t: { type: 'category' | 'item'; id: string }) => {
      const path = t.type === 'category' ? `/api/admin/menu/categories/${t.id}` : `/api/admin/menu/items/${t.id}`;
      return apiFetch(path, { method: 'DELETE' });
    },
    onSuccess: () => {
      setDeleteTarget(null);
      invalidateMenu(qc);
    },
  });

  const moveCategory = async (cat: AdminMenuCategory, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === cat.id);
    const swap = categories[idx + dir];
    if (!swap) return;
    await Promise.all([
      apiFetch(`/api/admin/menu/categories/${cat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      apiFetch(`/api/admin/menu/categories/${swap.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sortOrder: cat.sortOrder }),
      }),
    ]);
    invalidateMenu(qc);
  };

  const moveItem = async (item: AdminMenuItem, dir: -1 | 1) => {
    const list = itemsByCategory.get(item.categoryId) ?? [];
    const idx = list.findIndex((i) => i.id === item.id);
    const swap = list[idx + dir];
    if (!swap) return;
    await Promise.all([
      apiFetch(`/api/admin/menu/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      apiFetch(`/api/admin/menu/items/${swap.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      }),
    ]);
    invalidateMenu(qc);
  };

  const openCreateCategory = () => {
    setCatForm(emptyCategory());
    setCatDialog({ mode: 'create' });
  };

  const openEditCategory = (c: AdminMenuCategory) => {
    setCatForm({
      slug: c.slug,
      nameCz: c.nameCz,
      nameEn: c.nameEn,
      iconKey: (MENU_ICON_KEYS.includes(c.iconKey as MenuIconKey) ? c.iconKey : 'star') as MenuIconKey,
      imageUrl: c.imageUrl ?? '',
      active: c.active,
    });
    setCatDialog({ mode: 'edit', id: c.id });
  };

  const openCreateItem = (categoryId: string) => {
    setItemForm(emptyItem(categoryId));
    setItemDialog({ mode: 'create', categoryId });
  };

  const openEditItem = (item: AdminMenuItem) => {
    setItemForm({
      categoryId: item.categoryId,
      nameCz: item.nameCz,
      nameEn: item.nameEn,
      descCz: item.descCz ?? '',
      descEn: item.descEn ?? '',
      priceKc: String(Math.round(item.priceCents / 100)),
      allergenCodes: item.allergenCodes ?? '',
      imageUrl: item.imageUrl ?? '',
      active: item.active,
    });
    setItemDialog({ mode: 'edit', id: item.id });
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="rounded-md border border-black/10 p-4 space-y-3">
        <h3 className="font-medium">Sekce Menu na webu</h3>
        <p className="text-sm text-black/60">Volitelná hero fotka nad nadpisem „Menu“.</p>
        <ImageUrlField
          label="Hero fotka menu"
          value={heroDraft}
          onChange={(v) => {
            setHeroTouched(true);
            setHeroDraft(v);
          }}
          purpose="menu-hero"
        />
        <Button type="button" size="sm" disabled={saveHero.isPending} onClick={() => saveHero.mutate(heroDraft)}>
          Uložit hero fotku
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-black/60">Oddíly a produkty. Neaktivní položky se na webu nezobrazí.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/#menu" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1 inline" />
              Náhled webu
            </a>
          </Button>
          <Button type="button" size="sm" onClick={openCreateCategory}>
            <Plus className="w-4 h-4 mr-1 inline" />
            Nový oddíl
          </Button>
        </div>
      </div>

      {menuQuery.isLoading && <p className="text-sm text-black/60">Načítání menu…</p>}
      {menuQuery.isError && <p className="text-sm text-red-600">{(menuQuery.error as Error).message}</p>}

      <div className="space-y-4">
        {categories.map((cat, catIdx) => {
          const Icon = getMenuCategoryIcon(cat.iconKey);
          const catItems = itemsByCategory.get(cat.id) ?? [];
          const isOpen = expanded[cat.id] !== false;
          return (
            <div
              key={cat.id}
              className={`border border-black/10 rounded-md overflow-hidden ${!cat.active ? 'opacity-50' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2 p-3 bg-black/[0.02] border-b border-black/5">
                <button
                  type="button"
                  className="p-1"
                  onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !isOpen }))}
                  aria-label={isOpen ? 'Sbalit' : 'Rozbalit'}
                >
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="font-medium flex-1 min-w-0 truncate">{cat.nameCz}</span>
                <span className="text-xs text-black/50">{cat.slug}</span>
                <div className="flex items-center gap-1 text-xs">
                  <span>Na webu</span>
                  <Switch
                    checked={cat.active}
                    onCheckedChange={(v) => toggleCatActive.mutate({ id: cat.id, active: v })}
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" disabled={catIdx === 0} onClick={() => void moveCategory(cat, -1)}>
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={catIdx === categories.length - 1}
                  onClick={() => void moveCategory(cat, 1)}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => openEditCategory(cat)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTarget({ type: 'category', id: cat.id, label: cat.nameCz })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {isOpen && (
                <div className="p-3 space-y-3">
                  {cat.imageUrl && (
                    <img src={cat.imageUrl} alt="" className="w-full max-h-40 object-cover rounded" />
                  )}
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => openCreateItem(cat.id)}>
                      <Plus className="w-4 h-4 mr-1 inline" />
                      Přidat produkt
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14" />
                        <TableHead>Název</TableHead>
                        <TableHead>Cena</TableHead>
                        <TableHead>Alergeny</TableHead>
                        <TableHead className="text-center">Na webu</TableHead>
                        <TableHead className="text-right">Akce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-black/50 py-6">
                            Žádné produkty
                          </TableCell>
                        </TableRow>
                      )}
                      {catItems.map((item, itemIdx) => (
                        <TableRow key={item.id} className={!item.active ? 'opacity-50' : undefined}>
                          <TableCell>
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="w-10 h-10 object-cover" />
                            ) : (
                              <span className="text-black/30 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{item.nameCz}</div>
                            {item.nameEn !== item.nameCz && (
                              <div className="text-xs text-black/50">{item.nameEn}</div>
                            )}
                          </TableCell>
                          <TableCell>{formatKc(item.priceCents)}</TableCell>
                          <TableCell className="text-xs text-black/60 max-w-[8rem] truncate">
                            {item.allergenCodes ?? '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={item.active}
                              onCheckedChange={(v) => toggleItemActive.mutate({ id: item.id, active: v })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={itemIdx === 0}
                                onClick={() => void moveItem(item, -1)}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={itemIdx === catItems.length - 1}
                                onClick={() => void moveItem(item, 1)}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({ type: 'item', id: item.id, label: item.nameCz })
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={catDialog !== null} onOpenChange={(o) => !o && setCatDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{catDialog?.mode === 'create' ? 'Nový oddíl' : 'Upravit oddíl'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Název CZ</Label>
              <Input
                value={catForm.nameCz}
                onChange={(e) => {
                  const nameCz = e.target.value;
                  setCatForm((s) => ({
                    ...s,
                    nameCz,
                    slug: catDialog?.mode === 'create' ? slugify(nameCz) : s.slug,
                  }));
                }}
              />
            </div>
            <div>
              <Label>Název EN</Label>
              <Input value={catForm.nameEn} onChange={(e) => setCatForm((s) => ({ ...s, nameEn: e.target.value }))} />
            </div>
            {catDialog?.mode === 'create' ? (
              <div>
                <Label>Slug (URL)</Label>
                <Input value={catForm.slug} onChange={(e) => setCatForm((s) => ({ ...s, slug: slugify(e.target.value) }))} />
              </div>
            ) : (
              <p className="text-xs text-black/50">
                Slug: <code>{catForm.slug}</code>
              </p>
            )}
            <IconPicker value={catForm.iconKey} onChange={(iconKey) => setCatForm((s) => ({ ...s, iconKey }))} />
            <ImageUrlField
              label="Fotka oddílu"
              value={catForm.imageUrl}
              onChange={(imageUrl) => setCatForm((s) => ({ ...s, imageUrl }))}
              purpose="menu-category"
            />
            <div className="flex items-center gap-2">
              <Switch checked={catForm.active} onCheckedChange={(active) => setCatForm((s) => ({ ...s, active }))} />
              <Label>Zobrazovat na webu</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatDialog(null)}>
              Zrušit
            </Button>
            <Button
              type="button"
              disabled={saveCategory.isPending || !catForm.nameCz || !catForm.nameEn || !catForm.slug}
              onClick={() => saveCategory.mutate()}
            >
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialog !== null} onOpenChange={(o) => !o && setItemDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{itemDialog?.mode === 'create' ? 'Nový produkt' : 'Upravit produkt'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Oddíl</Label>
              <Select
                value={itemForm.categoryId}
                onValueChange={(categoryId) => setItemForm((s) => ({ ...s, categoryId }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte oddíl" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nameCz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Název CZ</Label>
              <Input value={itemForm.nameCz} onChange={(e) => setItemForm((s) => ({ ...s, nameCz: e.target.value }))} />
            </div>
            <div>
              <Label>Název EN</Label>
              <Input value={itemForm.nameEn} onChange={(e) => setItemForm((s) => ({ ...s, nameEn: e.target.value }))} />
            </div>
            <div>
              <Label>Popis CZ</Label>
              <Textarea value={itemForm.descCz} onChange={(e) => setItemForm((s) => ({ ...s, descCz: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Popis EN</Label>
              <Textarea value={itemForm.descEn} onChange={(e) => setItemForm((s) => ({ ...s, descEn: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Cena (Kč)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={itemForm.priceKc}
                onChange={(e) => setItemForm((s) => ({ ...s, priceKc: e.target.value }))}
              />
            </div>
            <div>
              <Label>Alergeny</Label>
              <Input
                value={itemForm.allergenCodes}
                onChange={(e) => setItemForm((s) => ({ ...s, allergenCodes: e.target.value }))}
                placeholder="např. 1, 3, 7"
              />
              <p className="text-xs text-black/50 mt-1">Čísla alergenů oddělená čárkou (1–14).</p>
            </div>
            <ImageUrlField
              label="Fotka produktu"
              value={itemForm.imageUrl}
              onChange={(imageUrl) => setItemForm((s) => ({ ...s, imageUrl }))}
              purpose="menu-item"
            />
            <div className="flex items-center gap-2">
              <Switch checked={itemForm.active} onCheckedChange={(active) => setItemForm((s) => ({ ...s, active }))} />
              <Label>Zobrazovat na webu</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setItemDialog(null)}>
              Zrušit
            </Button>
            <Button
              type="button"
              disabled={
                saveItem.isPending ||
                !itemForm.nameCz ||
                !itemForm.nameEn ||
                !itemForm.categoryId ||
                itemForm.priceKc === ''
              }
              onClick={() => saveItem.mutate()}
            >
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat „{deleteTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'category'
                ? 'Smaže se oddíl i všechny produkty v něm. Tuto akci nelze vrátit.'
                : 'Produkt bude trvale odstraněn z databáze.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteEntity.mutate({ type: deleteTarget.type, id: deleteTarget.id })}
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


