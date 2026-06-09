import { apiFetch } from '@/lib/api';

type PresignPurpose = 'menu-item' | 'menu-category' | 'menu-hero';

export async function uploadAdminImage(file: File, purpose: PresignPurpose): Promise<string> {
  const mime = file.type || 'image/jpeg';
  const { uploadUrl, publicUrl } = await apiFetch<{ uploadUrl: string; publicUrl: string }>(
    '/api/admin/uploads/presign',
    {
      method: 'POST',
      body: JSON.stringify({ purpose, mime }),
    }
  );
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': mime },
  });
  if (!res.ok) {
    throw new Error(`Nahrání souboru selhalo (${res.status})`);
  }
  return publicUrl;
}
