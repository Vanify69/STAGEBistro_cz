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

function cleanObjectKey(key: string): string {
  return key.replace(/^\//, '');
}

/** Veřejná URL = R2_PUBLIC_BASE_URL + object key (bez přidávání jména bucketu). */
export function publicUrlForStorageKey(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!base) {
    throw new Error('R2_PUBLIC_BASE_URL is not configured');
  }
  return `${base}/${cleanObjectKey(key)}`;
}

/**
 * Legacy: staré uploady skončily pod `stagebistro/stagebistro/menu-…`
 * zatímco v DB je často jen `stagebistro/menu-…`. Nové URL (`menu-item/…`) nechává být.
 */
export function normalizePublicMediaUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') return url ?? null;
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!base || !url.startsWith(`${base}/`)) return url;
  const path = url.slice(base.length + 1).replace(/^\//, '');
  // Už správně (nové i opravené legacy)
  if (path.startsWith('menu-item/') || path.startsWith('menu-category/') || path.startsWith('menu-hero/')) {
    return url;
  }
  if (path.startsWith('stagebistro/stagebistro/')) {
    return url;
  }
  // DB má stagebistro/menu-item/... → soubor je na stagebistro/stagebistro/menu-item/...
  if (/^stagebistro\/(menu-item|menu-category|menu-hero)\//.test(path)) {
    return `${base}/stagebistro/${path}`;
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
    new GetObjectCommand({ Bucket: bucket, Key: cleanObjectKey(key) })
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
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: cleanObjectKey(key) });
  return getSignedUrl(client, cmd, { expiresIn });
}
