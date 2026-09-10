import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { aiService, type AIChatOptions } from "../services/ai.js";

const chatSchemaZod = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4096).optional(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

const chatSchema = zodToJsonSchema(chatSchemaZod);

const chatResponseZod = z.object({
  content: z.string(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
});

const chatResponseSchema = zodToJsonSchema(chatResponseZod);

const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

const providersResponseZod = z.object({
  providers: z.array(z.string()),
  default: z.string().nullable(),
});
const providersResponseSchema = zodToJsonSchema(providersResponseZod);

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // Chat completion
  app.post("/api/ai/chat", {
    schema: {
      tags: ["AI"],
      summary: "Chat with AI assistant",
      body: chatSchema,
      response: {
        200: chatResponseSchema,
        400: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as AIChatOptions;
      const response = await aiService.chat(body);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not configured")) {
        return reply.status(503).send({
          error: "service_unavailable",
          message: "AI service is not configured. Please set up API keys.",
        });
      }
      throw error;
    }
  });

  // Streaming chat
  app.post("/api/ai/chat/stream", {
    schema: {
      tags: ["AI"],
      summary: "Stream chat with AI assistant",
      body: chatSchema,
      response: {
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as AIChatOptions;
      const options = { ...body, stream: true };

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      for await (const chunk of aiService.chatStream(options)) {
        reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      reply.raw.write("data: [DONE]\n\n");
      reply.raw.end();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not configured")) {
        reply.raw.writeHead(503);
        reply.raw.end(JSON.stringify({
          error: "service_unavailable",
          message: "AI service is not configured. Please set up API keys.",
        }));
        return;
      }
      throw error;
    }
  });

  // List available providers
  app.get("/api/ai/providers", {
    schema: {
      tags: ["AI"],
      summary: "List available AI providers",
      response: {
        200: providersResponseSchema,
      },
    },
  }, async () => {
    return {
      providers: aiService.listProviders(),
      default: aiService.listProviders()[0] || null,
    };
  });
}