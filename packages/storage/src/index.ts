import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | undefined;

function client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) throw new Error("S3_ENDPOINT is not set");
  _client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  return _client;
}

function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not set");
  return b;
}

export interface PutResult {
  s3Key: string;
  sha256: string;
  size: number;
}

/**
 * Upload a buffer with content-addressed key:  blobs/<sha256-prefix>/<sha256>
 * If a key already exists with the same hash, skip the put (cheap dedup).
 */
export async function putBlob(
  body: Buffer,
  opts: { mime: string; filename?: string },
): Promise<PutResult> {
  const sha256 = crypto.createHash("sha256").update(body).digest("hex");
  const s3Key = `blobs/${sha256.slice(0, 2)}/${sha256}`;
  const c = client();

  // Skip if already present.
  try {
    await c.send(new HeadObjectCommand({ Bucket: bucket(), Key: s3Key }));
    return { s3Key, sha256, size: body.length };
  } catch {
    // not found — fall through
  }

  await c.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: s3Key,
      Body: body,
      ContentType: opts.mime,
      ContentDisposition: opts.filename
        ? `attachment; filename="${opts.filename}"`
        : undefined,
      Metadata: { sha256 },
    }),
  );
  return { s3Key, sha256, size: body.length };
}

export async function getBlob(s3Key: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: s3Key }));
  const stream = res.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function presignGetUrl(s3Key: string, ttlSeconds = 60 * 30): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: s3Key }),
    { expiresIn: ttlSeconds },
  );
}
