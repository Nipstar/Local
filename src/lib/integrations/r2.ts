/**
 * Cloudflare R2 (S3-compatible) — owner photo uploads (spec Phase 4).
 *
 * Mock mode: when R2 credentials are absent, uploads are not stored; a
 * deterministic placeholder URL is returned so the editor flow is testable
 * without a bucket.
 */
const cfg = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (accountId && accessKeyId && secretAccessKey && bucket && publicUrl) {
    return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
  }
  return null;
};

export const r2Live = () => cfg() !== null;

export async function uploadPhoto(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ url: string; mocked: boolean }> {
  const c = cfg();
  if (!c) {
    // Mock: don't store; return a stable placeholder so the UI fills the slot.
    return { url: `/r2-mock/${encodeURIComponent(key)}`, mocked: true };
  }

  // Lazy import so the SDK isn't loaded in mock/dev paths.
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
  return { url: `${c.publicUrl.replace(/\/$/, "")}/${key}`, mocked: false };
}
