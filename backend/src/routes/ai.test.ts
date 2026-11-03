import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { aiRoutes } from "./ai.js";

const app = Fastify();

before(async () => { await app.register(aiRoutes); });
after(async () => { await app.close(); });

test("reports an empty provider list and rejects chat honestly when unconfigured", async () => {
  const providers = await app.inject({ method: "GET", url: "/api/ai/providers" });
  assert.equal(providers.statusCode, 200);
  assert.deepEqual(providers.json(), { providers: [], default: null });

  const chat = await app.inject({ method: "POST", url: "/api/ai/chat", payload: { messages: [{ role: "user", content: "Explain energy" }] } });
  assert.equal(chat.statusCode, 503);
  assert.equal(chat.json().error, "service_unavailable");
});

test("bounds chat messages and their size", async () => {
  const tooMany = await app.inject({ method: "POST", url: "/api/ai/chat", payload: { messages: Array.from({ length: 33 }, () => ({ role: "user", content: "x" })) } });
  assert.equal(tooMany.statusCode, 400);
  const tooLong = await app.inject({ method: "POST", url: "/api/ai/chat", payload: { messages: [{ role: "user", content: "x".repeat(8_001) }] } });
  assert.equal(tooLong.statusCode, 400);
});
