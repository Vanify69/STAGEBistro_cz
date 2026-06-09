const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function mimeForContractKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

export function extForContractMime(mime: string): string | null {
  return MIME_EXT[mime] ?? null;
}

export const CONTRACT_SCAN_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
