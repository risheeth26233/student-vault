import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { imageService, type ImageGenerationOptions } from "../services/images.js";

const generateSchemaZod = z.object({
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(2000).optional(),
  width: z.number().min(64).max(1024).optional().default(512),
  height: z.number().min(64).max(1024).optional().default(512),
  steps: z.number().min(1).max(100).optional(),
  guidanceScale: z.number().min(1).max(20).optional(),
  seed: z.number().optional(),
  model: z.string().optional(),
  format: z.enum(["png", "jpeg", "webp"]).optional().default("png"),
});

const generateSchema = zodToJsonSchema(generateSchemaZod);

const generatedImageZod = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  prompt: z.string(),
  seed: z.number(),
});

const generateResponseZod = z.object({
  images: z.array(generatedImageZod),
  creditsUsed: z.number().optional(),
});

const generateResponseSchema = zodToJsonSchema(generateResponseZod);

const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

const statusResponseZod = z.object({ configured: z.boolean() });
const statusResponseSchema = zodToJsonSchema(statusResponseZod);

export async function imagesRoutes(app: FastifyInstance): Promise<void> {
  // Generate image
  app.post("/api/images/generate", {
    schema: {
      tags: ["Images"],
      summary: "Generate an educational image/diagram",
      body: generateSchema,
      response: {
        200: generateResponseSchema,
        400: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const options = request.body as ImageGenerationOptions;
      const response = await imageService.generate(options);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not configured")) {
        return reply.status(503).send({
          error: "service_unavailable",
          message: "Image generation service is not configured. Please set FAL_API_KEY or OPENAI_API_KEY.",
        });
      }
      throw error;
    }
  });

  // Service status
  app.get("/api/images/status", {
    schema: {
      tags: ["Images"],
      summary: "Check image generation service configuration",
      response: {
        200: statusResponseSchema,
      },
    },
  }, async () => {
    return { configured: imageService.isConfigured() };
  });
}