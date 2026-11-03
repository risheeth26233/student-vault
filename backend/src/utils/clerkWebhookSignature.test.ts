import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyClerkWebhookSignature } from "./clerkWebhookSignature.js";

const nowMs = 1_800_000_000_000;
const secret = `whsec_${Buffer.from("test signing key").toString("base64")}`;
const rawBody = Buffer.from('{"type":"user.created"}');
const id = "msg_123";
const timestamp = String(Math.floor(nowMs / 1000));
const signature = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
  .update(`${id}.${timestamp}.`).update(rawBody).digest("base64");

test("accepts an authentic Svix v1 signature over the raw body", () => {
  assert.equal(verifyClerkWebhookSignature({ secret, id, timestamp, signature: `v1,${signature}`, rawBody, nowMs }), true);
});

test("rejects altered payloads, stale timestamps and missing headers", () => {
  assert.equal(verifyClerkWebhookSignature({ secret, id, timestamp, signature: `v1,${signature}`, rawBody: Buffer.from("{}"), nowMs }), false);
  assert.equal(verifyClerkWebhookSignature({ secret, id, timestamp: String(Number(timestamp) - 400), signature: `v1,${signature}`, rawBody, nowMs }), false);
  assert.equal(verifyClerkWebhookSignature({ secret, id, timestamp, signature: undefined, rawBody, nowMs }), false);
});
