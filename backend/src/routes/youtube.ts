import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { youtubeService, type YouTubeSearchOptions } from "../services/youtube.js";

const searchSchemaZod = z.object({
  query: z.string().min(1).max(500),
  maxResults: z.number().min(1).max(50).optional().default(10),
  order: z.enum(["relevance", "date", "rating", "viewCount", "title"]).optional(),
  type: z.enum(["video", "channel", "playlist"]).optional().default("video"),
  videoDuration: z.enum(["any", "short", "medium", "long"]).optional(),
  videoDefinition: z.enum(["any", "high", "standard"]).optional(),
  safeSearch: z.enum(["none", "moderate", "strict"]).optional().default("moderate"),
});

const searchSchema = zodToJsonSchema(searchSchemaZod);

const videoZod = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  thumbnailUrl: z.string(),
  channelTitle: z.string(),
  publishedAt: z.string(),
  duration: z.string(),
  viewCount: z.number(),
  embedUrl: z.string(),
});

const videoParamsZod = z.object({ id: z.string() });
const videoParamsSchema = zodToJsonSchema(videoParamsZod);

const searchResponseZod = z.object({
  videos: z.array(videoZod),
  nextPageToken: z.string().optional(),
  totalResults: z.number(),
});

const searchResponseSchema = zodToJsonSchema(searchResponseZod);

const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

const statusResponseZod = z.object({ configured: z.boolean() });
const statusResponseSchema = zodToJsonSchema(statusResponseZod);

const videoResponseZod = videoZod.nullable();
const videoResponseSchema = zodToJsonSchema(videoResponseZod);

export async function youtubeRoutes(app: FastifyInstance): Promise<void> {
  // Search videos
  app.post("/api/youtube/search", {
    schema: {
      tags: ["YouTube"],
      summary: "Search YouTube videos",
      body: searchSchema,
      response: {
        200: searchResponseSchema,
        400: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const options = request.body as YouTubeSearchOptions;
      const response = await youtubeService.search(options);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not configured")) {
        return reply.status(503).send({
          error: "service_unavailable",
          message: "YouTube service is not configured. Please set YOUTUBE_API_KEY.",
        });
      }
      throw error;
    }
  });

  // Get video details
  app.get("/api/youtube/videos/:id", {
    schema: {
      tags: ["YouTube"],
      summary: "Get video details by ID",
      params: videoParamsSchema,
      response: {
        200: videoResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const video = await youtubeService.getVideo(id);
      return video;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not configured")) {
        return reply.status(503).send({
          error: "service_unavailable",
          message: "YouTube service is not configured. Please set YOUTUBE_API_KEY.",
        });
      }
      throw error;
    }
  });

  // Service status
  app.get("/api/youtube/status", {
    schema: {
      tags: ["YouTube"],
      summary: "Check YouTube service configuration",
      response: {
        200: statusResponseSchema,
      },
    },
  }, async () => {
    return { configured: youtubeService.isConfigured() };
  });
}