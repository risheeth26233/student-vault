import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { handwritingRoutes } from "./handwriting.js";
import { ocrService, UnavailableOcrProvider, type OcrProvider } from "../services/ocr.js";

const page = { id: "page-1", dataUrl: "data:image/png;base64,aGVsbG8=" };
let app: ReturnType<typeof Fastify>;

function provider(extract: OcrProvider["extract"]): OcrProvider {
  return { name: "test-provider", isConfigured: () => true, extract };
}

beforeEach(async () => {
  app = Fastify();
  // Exercise the same protected-route boundary without live Clerk credentials.
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.startsWith("/api/handwriting/") && request.headers.authorization !== "Bearer test-session") {
      return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });
    }
  });
  await app.register(handwritingRoutes);
});

afterEach(async () => {
  ocrService.setProvider(new UnavailableOcrProvider());
  await app.close();
});

test("rejects unauthenticated extraction requests", async () => {
  const response = await app.inject({ method: "POST", url: "/api/handwriting/extract", payload: { consent: true, pages: [page] } });
  assert.equal(response.statusCode, 401);
});

test("rejects unaccepted consent and malformed page data", async () => {
  const headers = { authorization: "Bearer test-session" };
  const noConsent = await app.inject({ method: "POST", url: "/api/handwriting/extract", headers, payload: { consent: false, pages: [page] } });
  assert.equal(noConsent.statusCode, 400);
  assert.equal(noConsent.json().error, "consent_required");
  const invalid = await app.inject({ method: "POST", url: "/api/handwriting/extract", headers, payload: { consent: true, pages: [{ id: "x", dataUrl: "data:text/plain;base64,aGVsbG8=" }] } });
  assert.equal(invalid.statusCode, 400);
});

test("rejects more than eight pages and oversized encoded pages", async () => {
  const headers = { authorization: "Bearer test-session" };
  const tooMany = await app.inject({ method: "POST", url: "/api/handwriting/extract", headers, payload: { consent: true, pages: Array.from({ length: 9 }, (_, i) => ({ ...page, id: `p${i}` })) } });
  assert.equal(tooMany.statusCode, 400);
  const tooLarge = await app.inject({ method: "POST", url: "/api/handwriting/extract", headers, payload: { consent: true, pages: [{ id: "large", dataUrl: `data:image/png;base64,${"a".repeat(11_200_001)}` }] } });
  assert.equal(tooLarge.statusCode, 400);
});

test("returns an explicit unavailable-provider response", async () => {
  const response = await app.inject({ method: "POST", url: "/api/handwriting/extract", headers: { authorization: "Bearer test-session" }, payload: { consent: true, pages: [page] } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "ocr_unavailable");
});

test("returns configured provider extraction and preserves page identity", async () => {
  ocrService.setProvider(provider(async (pages) => ({ provider: "test-provider", configured: true, pages: pages.map((item) => ({ id: item.id, status: "low_confidence", text: "x = 2", estimatedConfidence: 0.4, notes: ["uncertain symbol"] })) })));
  const response = await app.inject({ method: "POST", url: "/api/handwriting/extract", headers: { authorization: "Bearer test-session" }, payload: { consent: true, pages: [page] } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().pages[0].id, page.id);
  assert.equal(response.json().pages[0].status, "low_confidence");
});

test("provider exceptions become safe generic errors", async () => {
  ocrService.setProvider(provider(async () => { throw new Error("secret provider detail"); }));
  const response = await app.inject({ method: "POST", url: "/api/handwriting/extract", headers: { authorization: "Bearer test-session" }, payload: { consent: true, pages: [page] } });
  assert.equal(response.statusCode, 500);
  assert.equal(response.json().message, "Text extraction failed before completing every page. Retry, or transcribe the pages manually.");
  assert.equal(response.body.includes("secret provider detail"), false);
});
