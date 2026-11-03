import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import Fastify from "fastify";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { createAiStudyRoutes } from "./ai-study.js";

const apps: Array<ReturnType<typeof Fastify>> = [];

function setup(options: { userId?: string; resources: unknown[]; providerCalls: string[]; ocrCalls?: string[] }) {
  const app = Fastify();
  apps.push(app);
  app.addHook("preHandler", async (request) => {
    if (options.userId) (request as AuthenticatedRequest).dbUser = { id: options.userId, email: "student@example.test", name: "Student", role: "student" };
  });
  app.register(createAiStudyRoutes({
    db: { resource: { findMany: async (args) => {
      const query = args as { where: { userId: string; id: { in: string[] } } };
      assert.equal(query.where.userId, options.userId);
      return options.resources.filter((resource) => query.where.id.in.includes((resource as { id: string }).id)) as never;
    } } },
    pdfExtract: async () => ({ ok: true, pages: [{ page: 1, text: "Photosynthesis uses chlorophyll to absorb light." }], truncated: false }),
    getOcrProvider: () => ({ name: "test-ocr", isConfigured: () => true, extract: async (pages) => { options.ocrCalls?.push(pages[0].id); return { provider: "test-ocr", configured: true, pages: [{ id: pages[0].id, status: "ok", text: "Chlorophyll absorbs light in plant cells.", estimatedConfidence: 0.9, notes: [] }] }; } }),
    getProvider: () => ({ name: "test-provider", chat: async ({ messages }) => { options.providerCalls.push(JSON.stringify(messages)); return { content: `The document says chlorophyll absorbs light. [Resource: ${(options.resources[0] as { name: string }).name}, page 1]` }; } }),
  }));
  return app;
}

afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

test("requires an authenticated student and hides missing or foreign resource IDs", async () => {
  const unauthenticated = setup({ resources: [], providerCalls: [] });
  const noAuth = await unauthenticated.inject({ method: "POST", url: "/api/ai/study", payload: { question: "Explain photosynthesis", resourceIds: ["foreign"], shareWithProvider: false } });
  assert.equal(noAuth.statusCode, 401);

  const authenticated = setup({ userId: "student-1", resources: [], providerCalls: [] });
  const hidden = await authenticated.inject({ method: "POST", url: "/api/ai/study", payload: { question: "Explain photosynthesis", resourceIds: ["foreign"], shareWithProvider: false } });
  assert.equal(hidden.statusCode, 404);
  assert.match(hidden.json().message, /documents are unavailable/);
});

test("extracts owner resource locally by default and sends retrieved passages only with consent", async () => {
  const pdf = Buffer.from("%PDF-1.7");
  const resource = { id: "resource-1", name: "Biology.pdf", mimeType: "application/pdf", size: BigInt(pdf.length), data: `data:application/pdf;base64,${pdf.toString("base64")}`, r2Key: null };
  const providerCalls: string[] = [];
  const app = setup({ userId: "student-1", resources: [resource], providerCalls });

  const local = await app.inject({ method: "POST", url: "/api/ai/study", payload: { question: "What does chlorophyll do?", resourceIds: ["resource-1"], shareWithProvider: false } });
  assert.equal(local.statusCode, 200);
  assert.equal(local.json().mode, "local_excerpts");
  assert.equal(local.json().sources[0].resourceId, "resource-1");
  assert.equal(providerCalls.length, 0);

  const shared = await app.inject({ method: "POST", url: "/api/ai/study", payload: { question: "What does chlorophyll do?", resourceIds: ["resource-1"], shareWithProvider: true } });
  assert.equal(shared.statusCode, 200);
  assert.equal(shared.json().mode, "provider_grounded");
  assert.equal(providerCalls.length, 1);
  assert.match(providerCalls[0], /Photosynthesis uses chlorophyll/);
});

test("image OCR is consent-gated and unsupported image formats are reported", async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const image = { id: "image-1", name: "work.png", mimeType: "image/png", size: BigInt(png.length), data: `data:image/png;base64,${png.toString("base64")}`, r2Key: null };
  const ocrCalls: string[] = [];
  const providerCalls: string[] = [];
  const app = setup({ userId: "student-1", resources: [image], providerCalls, ocrCalls });

  const local = await app.inject({ method: "POST", url: "/api/ai/study", payload: { question: "What does chlorophyll do?", resourceIds: ["image-1"], shareWithProvider: false } });
  assert.equal(local.json().mode, "no_sources");
  assert.deepEqual(ocrCalls, []);
  assert.deepEqual(providerCalls, []);

  const consented = await app.inject({ method: "POST", url: "/api/ai/study", payload: { question: "What does chlorophyll do?", resourceIds: ["image-1"], shareWithProvider: true } });
  assert.equal(consented.json().mode, "provider_grounded");
  assert.deepEqual(ocrCalls, ["image-1"]);
  assert.equal(consented.json().extractionProviders[0], "test-ocr");
  assert.match(providerCalls.at(-1) ?? "", /Chlorophyll absorbs light in plant cells/);
});
