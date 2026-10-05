import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toJsonSchema } from "../utils/schema.js";

const healthResponseZod = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string(),
});

const healthResponseSchema = toJsonSchema(healthResponseZod);

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", {
    schema: {
      tags: ["Health"],
      summary: "Health check endpoint",
      response: {
        200: healthResponseSchema,
      },
    },
  }, async () => {
    return {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.NODE_ENV || "development",
    };
  });
}