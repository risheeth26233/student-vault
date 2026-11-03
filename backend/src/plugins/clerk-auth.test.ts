import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { clerkAuthPlugin } from "./clerk-auth.js";

const app = Fastify();

before(async () => {
  await clerkAuthPlugin(app);
  app.get("/api/private", async () => ({ ok: true }));
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/webhooks/clerk", async () => ({ signatureGuardRunsInRoute: true }));
});
after(async () => { await app.close(); });

test("applies auth as a root hook, while keeping health and signature-guarded webhook routes public to Clerk tokens", async () => {
  assert.equal((await app.inject({ method: "GET", url: "/api/private" })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/api/health" })).statusCode, 200);
  assert.equal((await app.inject({ method: "GET", url: "/api/webhooks/clerk" })).statusCode, 200);
});
