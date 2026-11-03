import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { aiService, type AIProvider } from "../services/ai.js";
import { answerFromDocuments, type ExtractedStudyDocument } from "../services/documentStudy.js";
import { extractPdfText } from "../services/documentExtractor.js";
import { ocrService, type OcrProvider } from "../services/ocr.js";
import { getObjectBytes, isR2Configured } from "../services/r2.js";
import { MAX_RESOURCE_BYTES, resourceBytesMatchMimeType, validateResourceUpload } from "../services/resourceValidation.js";
import { prisma } from "../utils/prisma.js";
import { toJsonSchema } from "../utils/schema.js";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";

const studyRequestZod = z.object({
  question: z.string().trim().min(1).max(4_000),
  resourceIds: z.array(z.string().min(1).max(64)).min(1).max(4).refine((ids) => new Set(ids).size === ids.length, "Resource IDs must be unique"),
  shareWithProvider: z.boolean().default(false),
});
const studyRequestSchema = toJsonSchema(studyRequestZod);
const studyResponseZod = z.object({
  mode: z.enum(["provider_grounded", "local_excerpts", "no_sources"]),
  answer: z.string(),
  sources: z.array(z.object({ resourceId: z.string(), title: z.string(), page: z.number().int(), text: z.string() })),
  sourceErrors: z.array(z.object({ resourceId: z.string(), title: z.string(), error: z.string() })),
  extractionProviders: z.array(z.string()),
  provider: z.string().nullable(),
  providerAttempted: z.boolean(),
  notice: z.string(),
});
const studyResponseSchema = toJsonSchema(studyResponseZod);
const errorSchema = toJsonSchema(z.object({ error: z.string(), message: z.string() }));

type ResourceRecord = { id: string; name: string; mimeType: string; size: bigint; data: string | null; r2Key: string | null };
type StudyDatabase = { resource: { findMany(args: unknown): Promise<ResourceRecord[]> } };
type StudyOcrProvider = Pick<OcrProvider, "name" | "isConfigured" | "extract">;
type StudyDependencies = {
  db?: StudyDatabase;
  pdfExtract?: typeof extractPdfText;
  getR2Bytes?: typeof getObjectBytes;
  r2Configured?: typeof isR2Configured;
  getOcrProvider?: () => StudyOcrProvider;
  getProvider?: () => Pick<AIProvider, "name" | "chat"> | undefined;
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const dataUrlPattern = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

function toBuffer(value: string | null, mimeType: string, expectedSize: number): Buffer | null {
  if (!value) return null;
  const match = dataUrlPattern.exec(value);
  if (!match || match[1] !== mimeType) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.toString("base64") !== match[2] || bytes.length !== expectedSize) return null;
  return bytes;
}

export function createAiStudyRoutes(dependencies: StudyDependencies = {}) {
  const db = dependencies.db ?? prisma;
  const pdfExtract = dependencies.pdfExtract ?? extractPdfText;
  const fetchR2 = dependencies.getR2Bytes ?? getObjectBytes;
  const hasR2 = dependencies.r2Configured ?? isR2Configured;
  const getOcrProvider = dependencies.getOcrProvider ?? (() => ocrService.getProvider());
  const getProvider = dependencies.getProvider ?? (() => {
    try { return aiService.getProvider(); } catch { return undefined; }
  });

  return async function aiStudyRoutes(app: FastifyInstance): Promise<void> {
    app.post("/api/ai/study", {
      bodyLimit: 32 * 1024,
      schema: {
        tags: ["AI"],
        summary: "Retrieve the current user's selected documents and optionally send excerpts to an AI provider",
        body: studyRequestSchema,
        response: { 200: studyResponseSchema, 400: errorSchema, 401: errorSchema, 404: errorSchema },
      },
    }, async (request: AuthenticatedRequest, reply) => {
      const userId = request.dbUser?.id;
      if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });
      const input = request.body as z.infer<typeof studyRequestZod>;
      const resources = await db.resource.findMany({
        where: { userId, id: { in: input.resourceIds } },
        select: { id: true, name: true, mimeType: true, size: true, data: true, r2Key: true },
      });
      // Same response for absent and foreign records prevents ID probing.
      if (resources.length !== input.resourceIds.length) return reply.status(404).send({ error: "not_found", message: "One or more selected documents are unavailable" });

      const extracted: ExtractedStudyDocument[] = [];
      for (const resource of resources) {
        const size = Number(resource.size);
        if (!Number.isSafeInteger(size) || size < 1 || size > MAX_RESOURCE_BYTES) {
          extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: "invalid_size" });
          continue;
        }
        const validation = validateResourceUpload({ userId, mimeType: resource.mimeType, size, data: resource.data, r2Key: resource.r2Key });
        if (!validation.ok) {
          extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: validation.code });
          continue;
        }
        let bytes = toBuffer(resource.data, resource.mimeType, size);
        if (!bytes && resource.r2Key) {
          if (!hasR2() || !resource.r2Key.startsWith(`users/${userId}/resources/`)) {
            extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: "resource_unavailable" });
            continue;
          }
          const cloudBytes = await fetchR2(resource.r2Key, MAX_RESOURCE_BYTES);
          if (cloudBytes && cloudBytes.byteLength === size) bytes = Buffer.from(cloudBytes);
        }
        if (!bytes || !resourceBytesMatchMimeType(resource.mimeType, bytes)) {
          extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: "resource_unavailable" });
          continue;
        }

        if (resource.mimeType === "application/pdf") {
          try {
            const parsed = await pdfExtract(bytes);
            extracted.push(parsed.ok
              ? { resourceId: resource.id, title: resource.name, pages: parsed.pages, truncated: parsed.truncated }
              : { resourceId: resource.id, title: resource.name, pages: [], error: parsed.error });
          } catch {
            extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: "extractor_failed" });
          }
        } else if (imageTypes.has(resource.mimeType)) {
          if (!input.shareWithProvider) {
            extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: "image_ocr_requires_explicit_provider_consent" });
            continue;
          }
          const ocr = getOcrProvider();
          if (!ocr.isConfigured()) {
            extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: "ocr_unavailable" });
            continue;
          }
          const dataUrl = `data:${resource.mimeType};base64,${bytes.toString("base64")}`;
          try {
            const result = await ocr.extract([{ id: resource.id, dataUrl }]);
            const page = result.pages[0];
            extracted.push(page && page.status !== "failed" && page.text.trim()
              ? { resourceId: resource.id, title: resource.name, pages: [{ page: 1, text: page.text }], extractionProvider: result.provider }
              : { resourceId: resource.id, title: resource.name, pages: [], extractionProvider: result.provider, error: page?.error ?? "ocr_failed" });
          } catch {
            extracted.push({ resourceId: resource.id, title: resource.name, pages: [], extractionProvider: ocr.name, error: "ocr_failed" });
          }
        } else {
          extracted.push({ resourceId: resource.id, title: resource.name, pages: [], error: "unsupported_type" });
        }
      }

      return answerFromDocuments({
        question: input.question,
        documents: extracted,
        shareWithProvider: input.shareWithProvider,
        provider: input.shareWithProvider ? getProvider() : undefined,
      });
    });
  };
}

export const aiStudyRoutes = createAiStudyRoutes({ db: prisma as unknown as StudyDatabase });
