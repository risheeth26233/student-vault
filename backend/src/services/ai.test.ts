import assert from "node:assert/strict";
import { test } from "node:test";
import { AIService } from "./ai.js";

test("an unconfigured AI service reports no providers and never returns synthetic output", async () => {
  const service = new AIService();
  assert.deepEqual(service.listProviders(), []);
  await assert.rejects(service.chat({ messages: [{ role: "user", content: "hello" }] }), /No AI provider configured/);
  await assert.rejects(service.chatStream({ messages: [{ role: "user", content: "hello" }] })[Symbol.asyncIterator]().next(), /No AI provider configured/);
});
