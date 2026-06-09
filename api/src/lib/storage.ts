import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getObjectBuffer,
  isR2Configured,
  putObjectBuffer,
  publicUrlForStorageKey,
} from './s3.js';

const LOCAL_ROOT = process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), '.storage');

function localPath(key: string): string {
  return path.join(LOCAL_ROOT, key.replace(/^\//, ''));
}

export async function putStorageBuffer(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  if (isR2Configured()) {
    await putObjectBuffer(key, body, contentType);
    return;
  }
  const filePath = localPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
}

export async function getStorageBuffer(key: string): Promise<Uint8Array | null> {
  if (isR2Configured()) {
    try {
      return await getObjectBuffer(key);
    } catch {
      return null;
    }
  }
  try {
    return await fs.readFile(localPath(key));
  } catch {
    return null;
  }
}

export function publicUrlForKey(key: string | null): string | null {
  if (!key) return null;
  if (isR2Configured() && process.env.R2_PUBLIC_BASE_URL) {
    try {
      return publicUrlForStorageKey(key);
    } catch {
      return null;
    }
  }
  return null;
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('Neplatný formát podpisu (očekáván data URL)');
  const mime = m[1]!;
  const bytes = Uint8Array.from(Buffer.from(m[2]!, 'base64'));
  return { mime, bytes };
}
