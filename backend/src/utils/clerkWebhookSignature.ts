import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/** Verify a Clerk/Svix v1 signature against the exact unparsed request body. */
export function verifyClerkWebhookSignature(input: {
  secret: string;
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: Buffer | undefined;
  nowMs?: number;
}): boolean {
  const { secret, id, timestamp, signature, rawBody } = input;
  if (!secret.startsWith("whsec_") || !id || !timestamp || !signature || !rawBody) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) return false;

  let key: Buffer;
  try {
    key = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.`).update(rawBody).digest();
  return signature.split(/\s+/).some((candidate) => {
    const [version, encoded] = candidate.split(",", 2);
    if (version !== "v1" || !encoded) return false;
    let actual: Buffer;
    try { actual = Buffer.from(encoded, "base64"); } catch { return false; }
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
