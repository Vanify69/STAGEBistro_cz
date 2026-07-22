import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

/** Jen origin endpointu — žádná cesta / jméno bucketu v URL. */
function normalizeR2Endpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}`;
  } catch {
    return trimmed;
  }
}

export function getR2Client(): S3Client | null {
  const endpointRaw = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpointRaw || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: normalizeR2Endpoint(endpointRaw),
    credentials: { accessKeyId, secretAccessKey },
    // Bez path-style R2 často uloží objekt jako `{bucket}/{key}` místo `{key}`.
    forcePathStyle: true,
  });
}

function cleanObjectKey(key: string): string {
  return key.replace(/^\//, '');
}

/** Veřejná URL = R2_PUBLIC_BASE_URL + object key. */
export function publicUrlForStorageKey(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!base) {
    throw new Error('R2_PUBLIC_BASE_URL is not configured');
  }
  return `${base}/${cleanObjectKey(key)}`;
}

/**
 * Legacy: když je v DB stará cesta se zanoreným `stagebistro/…`, nech ji.
 * Nové uploady jdou na `menu-item/…` přímo.
 */
export function normalizePublicMediaUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') return url ?? null;
  return url;
}

export async function presignPutObject(key: string, contentType: string): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  const client = getR2Client();
  if (!bucket || !client) {
    throw new Error('R2 is not configured');
  }
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: cleanObjectKey(key),
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn: 900 });
}

export async function putObjectBuffer(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  const bucket = process.env.R2_BUCKET;
  const client = getR2Client();
  if (!bucket || !client) {
    throw new Error('R2 is not configured');
  }
  const objectKey = cleanObjectKey(key);
  if (!objectKey || objectKey.includes('..')) {
    throw new Error(`Neplatný storage key: ${key}`);
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: Buffer.from(body),
      ContentType: contentType,
      ContentLength: body.byteLength,
    })
  );
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  } catch (err) {
    throw new Error(
      `R2 upload nešel ověřit (HeadObject key=${objectKey}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function getObjectBuffer(key: string): Promise<Uint8Array> {
  const bucket = process.env.R2_BUCKET;
  const client = getR2Client();
  if (!bucket || !client) {
    throw new Error('R2 is not configured');
  }
  const objectKey = cleanObjectKey(key);
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error('Empty object');
  return bytes;
}

export async function presignGetObject(key: string, expiresIn = 900): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  const client = getR2Client();
  if (!bucket || !client) {
    throw new Error('R2 is not configured');
  }
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: cleanObjectKey(key) });
  return getSignedUrl(client, cmd, { expiresIn });
}
