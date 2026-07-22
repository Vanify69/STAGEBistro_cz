import { getApiBase } from '@/lib/api';

export type UploadPurpose = 'menu-item' | 'menu-category' | 'menu-hero' | 'gallery' | 'menu-icon';

/** Nahrání přes API (server → R2). Bez přímého PUT z prohlížeče = bez CORS na bucketu. */
export async function uploadAdminImage(file: File, purpose: UploadPurpose): Promise<string> {
  const base = getApiBase();
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', file, file.name || 'image');

  const res = await fetch(`${base}/api/admin/uploads`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const text = await res.text();
  let data: { publicUrl?: string; error?: string } | null = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { publicUrl?: string; error?: string };
    } catch {
      throw new Error(
        `Nahrání selhalo (HTTP ${res.status}). Začátek odpovědi: ${text.slice(0, 120).trim()}`
      );
    }
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Nahrání selhalo (HTTP ${res.status})`);
  }
  if (!data?.publicUrl) {
    throw new Error('API nevrátilo URL obrázku');
  }
  return data.publicUrl;
}
