import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toJsonSchema } from "../utils/schema.js";
import { ocrService, type OcrPageInput } from "../services/ocr.js";

/** Maximum handwritten pages per extraction request (mirrors the UI limit). */
export const MAX_OCR_PAGES = 8;

/**
 * Base64 data-URL cap. 8 MiB of image bytes → ~11.19 MB of base64 plus the
 * `data:image/...;base64,` header, so anything ≤ this is an ≤8 MiB page.
 */
export const MAX_PAGE_DATA_URL_CHARS = 11_200_000;

/** Route-level body cap for 8 maximum-size pages plus JSON framing. */
const EXTRACT_BODY_LIMIT = 96 * 1024 * 1024;

const DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const ocrPageInputZod = z.object({
  id: z.string().min(1).max(64),
  dataUrl: z.string().min(1).max(MAX_PAGE_DATA_URL_CHARS).regex(DATA_URL_PATTERN),
});

const extractBodyZod = z.object({
  /** Explicit, client-recorded consent before pages leave the device. */
  consent: z.boolean(),
  pages: z.array(ocrPageInputZod).min(1).max(MAX_OCR_PAGES),
});

const ocrPageResultZod = z.object({
  id: z.string(),
  status: z.enum(["ok", "low_confidence", "failed"]),
  text: z.string(),
  estimatedConfidence: z.number().nullable(),
  notes: z.array(z.string()),
  error: z.string().optional(),
});

const extractResponseZod = z.object({
  provider: z.string(),
  configured: z.boolean(),
  pages: z.array(ocrPageResultZod),
});

const statusResponseZod = z.object({
  configured: z.boolean(),
  provider: z.string().nullable(),
  maxPages: z.number(),
  maxPageDataUrlChars: z.number(),
});

const errorResponseZod = z.object({ error: z.string(), message: z.string() });

const extractBodySchema = toJsonSchema(extractBodyZod);
const extractResponseSchema = toJsonSchema(extractResponseZod);
const statusResponseSchema = toJsonSchema(statusResponseZod);
const errorResponseSchema = toJsonSchema(errorResponseZod);

export async function handwritingRoutes(app: FastifyInstance): Promise<void> {
  // Extraction status — lets the UI state honestly whether automatic
  // extraction is available before the student uploads anything.
  app.get("/api/handwriting/status", {
    schema: {
      tags: ["Handwriting"],
      summary: "Check whether an OCR provider is configured",
      response: {
        200: statusResponseSchema,
      },
    },
  }, async () => {
    const configured = ocrService.isConfigured();
    return {
      configured,
      provider: configured ? ocrService.getProvider().name : null,
      maxPages: MAX_OCR_PAGES,
      maxPageDataUrlChars: MAX_PAGE_DATA_URL_CHARS,
    };
  });

  // Stateless page extraction: pages in, text out. Nothing is persisted here,
  // so the endpoint cannot read one student's stored records — authorization
  // is the global Clerk preHandler (401 without a valid session).
  app.post("/api/handwriting/extract", {
    bodyLimit: EXTRACT_BODY_LIMIT,
    schema: {
      tags: ["Handwriting"],
      summary: "Extract text from handwritten page images (consent required)",
      body: extractBodySchema,
      response: {
        200: extractResponseSchema,
        400: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof extractBodyZod>;

    if (body.consent !== true) {
      return reply.status(400).send({
        error: "consent_required",
        message: "Automatic extraction requires explicit consent to send these pages to the configured OCR provider.",
      });
    }

    if (!ocrService.isConfigured()) {
      return reply.status(503).send({
        error: "ocr_unavailable",
        message: "No OCR provider is configured. Transcribe the pages manually, or configure OCR_PROVIDER/OPENAI_API_KEY on the server.",
      });
    }

    try {
      const pages: OcrPageInput[] = body.pages.map((page) => ({
        id: page.id,
        dataUrl: page.dataUrl,
      }));
      const result = await ocrService.extract(pages);
      return result;
    } catch (error) {
      request.log.error({ err: error }, "OCR extraction failed");
      return reply.status(500).send({
        error: "ocr_failed",
        message: "Text extraction failed before completing every page. Retry, or transcribe the pages manually.",
      });
    }
  });
}
