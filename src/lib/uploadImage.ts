import { getApiBase } from '@/lib/api';

type UploadPurpose = 'menu-item' | 'menu-category' | 'menu-hero';

/** Nahrání přes API (server → R2). Bez přímého PUT z prohlížeče = bez CORS na bucketu. */
export async function uploadAdminImage(file: File, purpose: UploadPurpose): Promise<string> {
  const mime = file.type || 'image/jpeg';
  const base = getApiBase();
  const res = await fetch(`${base}/api/admin/uploads?purpose=${encodeURIComponent(purpose)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': mime },
    body: file,
  });
  const text = await res.text();
  let data: { publicUrl?: string; error?: string } | null = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { publicUrl?: string; error?: string };
    } catch {
      throw new Error(`Nahrání selhalo (HTTP ${res.status})`);
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
