import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { createImagesRoutes } from "./images.js";
import { ImageService } from "../services/images.js";

test("image routes report unavailable providers, validate models and sanitize provider failure", async () => {
  const service = new ImageService();
  const app = Fastify();
  await app.register(createImagesRoutes(service));
  try {
    assert.equal((await app.inject('/api/images/status')).json().configured, false);
    assert.equal((await app.inject({ method: 'POST', url: '/api/images/generate', payload: { prompt: 'Study diagram' } })).statusCode, 503);
    assert.equal((await app.inject({ method: 'POST', url: '/api/images/generate', payload: { prompt: 'Study diagram', model: 'unbounded-paid-model' } })).statusCode, 400);
    service.setProvider({ generate: async () => { throw new Error('private provider secret'); } });
    const failure = await app.inject({ method: 'POST', url: '/api/images/generate', payload: { prompt: 'Study diagram' } });
    assert.equal(failure.statusCode, 502);
    assert.doesNotMatch(failure.body, /private provider secret/);
  } finally { await app.close(); }
});
