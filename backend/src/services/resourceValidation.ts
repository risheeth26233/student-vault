export const MAX_RESOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_RESOURCE_DATA_URL_CHARS = Math.ceil(MAX_RESOURCE_BYTES / 3) * 4 + 64;

const allowedMagic: Record<string, (bytes: Buffer) => boolean> = {
  "application/pdf": (bytes) => bytes.subarray(0, 5).toString("ascii") === "%PDF-",
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/webp": (bytes) => bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
  "image/gif": (bytes) => ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)),
};

export function resourceBytesMatchMimeType(mimeType: string, bytes: Buffer): boolean {
  return allowedMagic[mimeType]?.(bytes) === true;
}

export function validateResourceUpload(input: {
  userId: string;
  mimeType: string;
  size: number;
  data?: string | null;
  r2Key?: string | null;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > MAX_RESOURCE_BYTES) {
    return { ok: false, code: "invalid_size", message: "Resource must be between 1 byte and 20 MiB" };
  }
  if (!Object.hasOwn(allowedMagic, input.mimeType)) {
    return { ok: false, code: "invalid_type", message: "Supported files are PDF, JPEG, PNG, WebP, or GIF" };
  }
  if (input.data && input.r2Key) return { ok: false, code: "invalid_storage", message: "Choose inline upload or cloud storage, not both" };
  if (!input.data && !input.r2Key) return { ok: false, code: "missing_file", message: "No file content or cloud-storage key was provided" };
  if (input.r2Key && !new RegExp(`^users/${escapeRegex(input.userId)}/resources/[A-Za-z0-9_-]+\\.[A-Za-z0-9]{1,12}$`).test(input.r2Key)) {
    return { ok: false, code: "invalid_storage", message: "Cloud resource key is outside this user's storage area" };
  }
  if (!input.data) return { ok: true };
  if (input.data.length > MAX_RESOURCE_DATA_URL_CHARS) return { ok: false, code: "file_too_large", message: "Encoded file exceeds the 20 MiB limit" };
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.data);
  if (!match || match[1] !== input.mimeType) return { ok: false, code: "invalid_data", message: "File data URL is malformed or has a different media type" };
  const encoded = match[2];
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded || bytes.length !== input.size) return { ok: false, code: "invalid_data", message: "File contents do not match the declared size" };
  if (!resourceBytesMatchMimeType(input.mimeType, bytes)) return { ok: false, code: "invalid_data", message: "File signature does not match its declared media type" };
  return { ok: true };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
