import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import type { PrismaClient } from "@prisma/client";
import { createClerkWebhookRoutes } from "./clerk-webhook.js";
import { registerWebhookBody } from "../plugins/webhook-body.js";

test("signed deletion accepts minimal payload, rejects tampering and oversized bodies", async () => {
  const key = Buffer.from("integration-test-webhook-secret");
  let deletes = 0;
  const db = { user: { deleteMany: async () => { deletes++; return { count: 1 }; } } } as unknown as PrismaClient;
  const app = Fastify({ bodyLimit: 256 });
  registerWebhookBody(app);
  await app.register(createClerkWebhookRoutes(db, `whsec_${key.toString("base64")}`));
  try {
    const payload = JSON.stringify({ type: "user.deleted", data: { id: "user-test", deleted: true } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const id = "msg-test";
    const headers = {
      "content-type": "application/json", "svix-id": id, "svix-timestamp": timestamp,
      "svix-signature": `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64")}`,
    };
    assert.equal((await app.inject({ method: "POST", url: "/api/webhooks/clerk", headers, payload })).statusCode, 200);
    assert.equal(deletes, 1);
    assert.equal((await app.inject({ method: "POST", url: "/api/webhooks/clerk", headers, payload: payload.replace("user-test", "other-user") })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/api/webhooks/clerk", headers, payload: JSON.stringify({ padding: "x".repeat(257) }) })).statusCode, 413);
    assert.equal(deletes, 1);
  } finally { await app.close(); }
});
