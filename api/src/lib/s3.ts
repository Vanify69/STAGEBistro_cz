import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

export async function presignPutObject(key: string, contentType: string): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  const client = getR2Client();
  if (!bucket || !client) {
    throw new Error('R2 is not configured');
  }
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn: 900 });
}

/** Veřejná URL nahraného souboru (R2_PUBLIC_BASE_URL + key). */
export function publicUrlForStorageKey(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!base) {
    throw new Error('R2_PUBLIC_BASE_URL is not configured');
  }
  return `${base}/${key.replace(/^\//, '')}`;
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
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObjectBuffer(key: string): Promise<Uint8Array> {
  const bucket = process.env.R2_BUCKET;
  const client = getR2Client();
  if (!bucket || !client) {
    throw new Error('R2 is not configured');
  }
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
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
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}
