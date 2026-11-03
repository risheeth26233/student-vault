import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { createReadinessRoutes } from "./readiness.js";
import { clerkAuthPlugin } from "../plugins/clerk-auth.js";

test("database readiness is public, bounded and does not expose database errors", async () => {
  for (const succeeds of [true, false]) {
    const app = Fastify();
    await clerkAuthPlugin(app);
    await app.register(createReadinessRoutes(async () => {
      if (!succeeds) throw new Error("private database credentials");
    }));
    try {
      const response = await app.inject({ method: "GET", url: "/api/ready" });
      assert.equal(response.statusCode, succeeds ? 200 : 503);
      assert.deepEqual(response.json(), { status: succeeds ? "ready" : "unavailable" });
      assert.equal(response.headers["cache-control"], "no-store");
    } finally { await app.close(); }
  }
});

test("a stalled database query times out and concurrent probes share one query", async () => {
  const app = Fastify();
  let calls = 0;
  await app.register(createReadinessRoutes(() => { calls++; return new Promise(() => {}); }, 20));
  try {
    const responses = await Promise.all(Array.from({ length: 5 }, () => app.inject({ method: "GET", url: "/api/ready" })));
    assert.ok(responses.every((response) => response.statusCode === 503));
    assert.equal(calls, 1);
    assert.equal((await app.inject({ method: "GET", url: "/api/ready" })).statusCode, 503);
    assert.equal(calls, 1);
  } finally { await app.close(); }
});
