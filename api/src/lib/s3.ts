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

export function getR2Client(): S3Client | null {
  const endpoint = process.env.R2_ENDPOINT?.replace(/\/+$/, '');
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function r2BucketName(): string {
  return (process.env.R2_BUCKET ?? '').replace(/^\/+|\/+$/g, '');
}

/**
 * Objekty v R2 končí pod `{bucket}/{logicalKey}`.
 * Logical key z app je často `stagebistro/menu-item/...` → veřejná cesta
 * `stagebistro/stagebistro/menu-item/...` (to, co funguje na r2.dev).
 */
export function resolveR2ObjectKey(logicalKey: string): string {
  const bucket = r2BucketName();
  let key = logicalKey.replace(/^\//, '');
  if (!bucket) return key;
  if (key.startsWith(`${bucket}/${bucket}/`)) return key;
  if (key.startsWith(`${bucket}/`)) return `${bucket}/${key}`;
  return `${bucket}/${key}`;
}

/** Veřejná URL nahraného souboru (R2_PUBLIC_BASE_URL + object key). */
export function publicUrlForStorageKey(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!base) {
    throw new Error('R2_PUBLIC_BASE_URL is not configured');
  }
  return `${base}/${resolveR2ObjectKey(key)}`;
}

/**
 * Opraví už uložené URL v DB, které mají jen jeden `stagebistro/`
 * místo skutečné cesty `stagebistro/stagebistro/...`.
 */
export function normalizePublicMediaUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') return url ?? null;
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  const bucket = r2BucketName();
  if (!base || !bucket || !url.startsWith(`${base}/`)) return url;
  const path = url.slice(base.length + 1).replace(/^\//, '');
  const single = `${bucket}/`;
  const doubled = `${bucket}/${bucket}/`;
  if (path.startsWith(single) && !path.startsWith(doubled)) {
    return `${base}/${bucket}/${path}`;
  }
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
    Key: resolveR2ObjectKey(key),
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
  const objectKey = resolveR2ObjectKey(key);
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
      `R2 upload nešel ověřit (HeadObject): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function getObjectBuffer(key: string): Promise<Uint8Array> {
  const bucket = process.env.R2_BUCKET;
  const client = getR2Client();
  if (!bucket || !client) {
    throw new Error('R2 is not configured');
  }
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: resolveR2ObjectKey(key) })
  );
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
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: resolveR2ObjectKey(key) });
  return getSignedUrl(client, cmd, { expiresIn });
}
