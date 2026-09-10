import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { searchService, type SearchOptions } from "../services/search.js";

const searchSchemaZod = z.object({
  query: z.string().min(1).max(500),
  maxResults: z.number().min(1).max(50).optional().default(10),
  safeSearch: z.enum(["off", "moderate", "strict"]).optional().default("moderate"),
  freshness: z.enum(["day", "week", "month", "year"]).optional(),
  language: z.string().optional(),
});

const searchSchema = zodToJsonSchema(searchSchemaZod);

const searchResultZod = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  source: z.string(),
  publishedAt: z.string().optional(),
});

const searchResponseZod = z.object({
  results: z.array(searchResultZod),
  query: z.string(),
  totalResults: z.number(),
});

const searchResponseSchema = zodToJsonSchema(searchResponseZod);

const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

const statusResponseZod = z.object({ configured: z.boolean() });
const statusResponseSchema = zodToJsonSchema(statusResponseZod);

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  // Web search
  app.post("/api/search", {
    schema: {
      tags: ["Search"],
      summary: "Search the web for educational resources",
      body: searchSchema,
      response: {
        200: searchResponseSchema,
        400: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const options = request.body as SearchOptions;
      const response = await searchService.search(options);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not configured")) {
        return reply.status(503).send({
          error: "service_unavailable",
          message: "Search service is not configured. Please set BRAVE_SEARCH_API_KEY.",
        });
      }
      throw error;
    }
  });

  // Service status
  app.get("/api/search/status", {
    schema: {
      tags: ["Search"],
      summary: "Check search service configuration",
      response: {
        200: statusResponseSchema,
      },
    },
  }, async () => {
    return { configured: searchService.isConfigured() };
  });
}