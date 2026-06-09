import { apiFetch, getApiBase } from '@/lib/api';

export async function uploadToPresignedUrl(uploadUrl: string, blob: Blob, mime: string): Promise<void> {
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: blob,
  });
  if (!put.ok) throw new Error('Upload selhal');
}

export async function uploadSignaturePng(
  presignPath: string,
  dataUrl: string
): Promise<string> {
  const presign = await apiFetch<{ uploadUrl?: string; storageKey: string }>(presignPath, {
    method: 'POST',
    body: JSON.stringify({ signatureDataUrl: dataUrl }),
  });
  if (!presign.uploadUrl) {
    return presign.storageKey;
  }
  const blob = await (await fetch(dataUrl)).blob();
  await uploadToPresignedUrl(presign.uploadUrl, blob, 'image/png');
  return presign.storageKey;
}

export async function uploadContractScan(workerId: string, file: File): Promise<void> {
  const mime = file.type || 'application/pdf';
  const base = getApiBase();
  const res = await fetch(`${base}/api/provoz/workers/${workerId}/contract/upload-scan`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': mime },
    body: file,
  });
  const text = await res.text();
  let data: { error?: string } | null = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      throw new Error(`Nahrání smlouvy selhalo (HTTP ${res.status})`);
    }
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Nahrání smlouvy selhalo (HTTP ${res.status})`);
  }
}
