import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "../config/env.js";

const env = getEnv();

let r2Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
    return null;
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

export function isR2Configured(): boolean {
  return getR2Client() !== null;
}

export function getR2BucketName(): string | null {
  return env.R2_BUCKET_NAME || null;
}

export function getR2PublicUrl(): string | null {
  return env.R2_PUBLIC_URL || null;
}

export async function generateUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function generateDownloadUrl(key: string, expiresIn = 3600): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteObject(key: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error) {
    console.error("R2 delete error:", error);
    return false;
  }
}

export async function objectExists(key: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;

  try {
    await client.send(new HeadObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function getObjectMetadata(key: string): Promise<{ size: number | null; contentType: string | null } | null> {
  const client = getR2Client();
  if (!client) return null;
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
    return { size: result.ContentLength ?? null, contentType: result.ContentType ?? null };
  } catch {
    return null;
  }
}

/** Reads an already-owned object only after its stored size has been checked by the caller. */
export async function getObjectBytes(key: string, maxBytes: number): Promise<Uint8Array | null> {
  const client = getR2Client();
  if (!client) return null;
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
    if (!response.Body || (response.ContentLength !== undefined && response.ContentLength > maxBytes)) return null;
    const bytes = await response.Body.transformToByteArray();
    return bytes.byteLength <= maxBytes ? bytes : null;
  } catch {
    return null;
  }
}

export function buildR2Key(userId: string, resourceId: string, fileName: string): string {
  const ext = fileName.split(".").pop() || "";
  return `users/${userId}/resources/${resourceId}.${ext}`;
}
