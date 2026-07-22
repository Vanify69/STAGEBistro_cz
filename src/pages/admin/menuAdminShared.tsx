import { useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { getMenuCategoryIcon, isCustomMenuIcon, MENU_ICON_KEYS, MENU_ICON_LABELS, type MenuIconKey } from '@/lib/menuIcons';
import { uploadAdminImage, type UploadPurpose } from '@/lib/uploadImage';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

export type PresignPurpose = Exclude<UploadPurpose, 'gallery'>;

export type CategoryFormState = {
  slug: string;
  nameCz: string;
  nameEn: string;
  /** Lucide klíč (beef, soup, …) nebo URL nahrané ikony. */
  iconKey: string;
  imageUrl: string;
  active: boolean;
};

export type ItemFormState = {
  categoryId: string;
  nameCz: string;
  nameEn: string;
  descCz: string;
  descEn: string;
  priceKc: string;
  allergenCodes: string;
  imageUrl: string;
  active: boolean;
};

export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'kategorie'
  );
}

export function formatKc(cents: number): string {
  return `${Math.round(cents / 100)} Kč`;
}

export function parseKcToCents(kc: string): number {
  const n = parseFloat(kc.replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function invalidateMenu(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
  void qc.invalidateQueries({ queryKey: ['public', 'site'] });
  void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
}

export const emptyCategory = (): CategoryFormState => ({
  slug: '',
  nameCz: '',
  nameEn: '',
  iconKey: 'star',
  imageUrl: '',
  active: true,
});

export const emptyItem = (categoryId: string): ItemFormState => ({
  categoryId,
  nameCz: '',
  nameEn: '',
  descCz: '',
  descEn: '',
  priceKc: '',
  allergenCodes: '',
  imageUrl: '',
  active: true,
});

export function ImageUrlField({
  label,
  value,
  onChange,
  purpose,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  purpose: PresignPurpose;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadAdminImage(file, purpose);
      onChange(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Nahrání selhalo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex gap-3 items-start">
          <img src={value} alt="" className="w-24 h-24 object-cover border border-black/10" />
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL obrázku" />
            <Button type="button" variant="outline" size="sm" onClick={() => onChange('')}>
              Odstranit fotku
            </Button>
          </div>
        </div>
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL obrázku (volitelné)" />
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Nahrávám…' : 'Nahrát soubor'}
        </Button>
        <span className="text-xs text-black/50">nebo vložte URL</span>
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isCustom = isCustomMenuIcon(value);
  const selectValue = !isCustom && MENU_ICON_KEYS.includes(value as MenuIconKey) ? value : 'star';
  const Icon = getMenuCategoryIcon(selectValue);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadAdminImage(file, 'menu-icon');
      onChange(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Nahrání selhalo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>Ikona u nadpisu</Label>
      <div className="flex items-center gap-3">
        {isCustom ? (
          <img src={value} alt="" className="w-8 h-8 object-contain" />
        ) : (
          <Icon className="w-8 h-8" />
        )}
        <Select
          value={isCustom ? '__custom__' : selectValue}
          onValueChange={(v) => {
            if (v === '__custom__') return;
            onChange(v);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isCustom && (
              <SelectItem value="__custom__" disabled>
                Vlastní nahraná ikona
              </SelectItem>
            )}
            {MENU_ICON_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {MENU_ICON_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Nahrávám…' : 'Nahrát vlastní ikonu'}
        </Button>
        {isCustom && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('star')}>
            Použít výchozí ikonu
          </Button>
        )}
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}


