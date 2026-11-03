import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import type { AuthenticatedRequest } from "./clerk-auth.js";
import { createRequestLimitHook } from "./request-limits.js";

const app = Fastify();
let now = 1000;

before(async () => {
  app.addHook("preHandler", async (request) => {
    (request as AuthenticatedRequest).dbUser = { id: request.headers["x-actor"] as string, email: "test@example.test", name: "test", role: "student" };
  });
  app.addHook("preHandler", createRequestLimitHook({ now: () => now, rules: [{ prefix: "/api/ai/chat", limit: 2, windowMs: 1000 }] }));
  app.post("/api/ai/chat", async () => ({ ok: true }));
});
after(async () => { await app.close(); });

test("limits sensitive requests by authenticated user and resets the window", async () => {
  const request = (actor: string) => app.inject({ method: "POST", url: "/api/ai/chat", headers: { "x-actor": actor } });
  assert.equal((await request("student-a")).statusCode, 200);
  assert.equal((await request("student-a")).statusCode, 200);
  const limited = await request("student-a");
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers["retry-after"], "1");
  assert.equal((await request("student-b")).statusCode, 200);
  now += 1000;
  assert.equal((await request("student-a")).statusCode, 200);
});
