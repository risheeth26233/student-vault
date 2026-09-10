import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "../utils/prisma.js";
import { getDbUserId, type AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { isR2Configured, generateDownloadUrl, buildR2Key, deleteObject } from "../services/r2.js";

const resourceResponseZod = z.object({
  id: z.string(),
  userId: z.string(),
  topicId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.string(), // BigInt serialized as string
  data: z.string().nullable(), // Base64 data URL (for local storage fallback)
  r2Key: z.string().nullable(), // R2 object key
  downloadUrl: z.string().nullable(), // Presigned download URL
  createdAt: z.string().datetime(),
});

const resourcesListResponseZod = z.object({
  resources: z.array(resourceResponseZod),
  total: z.number(),
});

const errorResponseZod = z.object({ error: z.string(), message: z.string() });

const resourceResponseSchema = zodToJsonSchema(resourceResponseZod);
const resourcesListResponseSchema = zodToJsonSchema(resourcesListResponseZod);
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

// For file upload - supports both base64 and R2 key
const resourceCreateZod = z.object({
  topicId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().or(z.string()),
  data: z.string().optional().nullable(), // Base64 data URL (optional when using R2)
  r2Key: z.string().optional().nullable(), // R2 object key (when using R2)
});

const resourceCreateSchema = zodToJsonSchema(resourceCreateZod);

export async function resourcesRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/resources - List all resources (optionally filtered by topicId)
  app.get("/api/resources", {
    schema: {
      tags: ["Resources"],
      summary: "List all resources for the user",
      querystring: z.object({
        topicId: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).optional().default(50),
        offset: z.coerce.number().min(0).optional().default(0),
      }),
      response: {
        200: resourcesListResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { topicId, limit, offset } = request.query as {
      topicId?: string;
      limit: number;
      offset: number;
    };

    const where: Record<string, unknown> = { userId };
    if (topicId) where.topicId = topicId;

    const [resources, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.resource.count({ where }),
    ]);

    // Generate download URLs for R2 resources
    const resourcesWithUrls = await Promise.all(resources.map(async (r) => {
      let downloadUrl: string | null = null;
      if (r.r2Key && isR2Configured()) {
        downloadUrl = await generateDownloadUrl(r.r2Key);
      }
      return {
        ...formatResource(r),
        downloadUrl,
      };
    }));

    return {
      resources: resourcesWithUrls,
      total,
    };
  });

  // GET /api/resources/:id - Get a single resource
  app.get("/api/resources/:id", {
    schema: {
      tags: ["Resources"],
      summary: "Get a resource by ID",
      params: z.object({ id: z.string() }),
      response: {
        200: resourceResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const resource = await prisma.resource.findFirst({ where: { id, userId } });

    if (!resource) {
      return reply.status(404).send({ error: "not_found", message: "Resource not found" });
    }

    let downloadUrl: string | null = null;
    if (resource.r2Key && isR2Configured()) {
      downloadUrl = await generateDownloadUrl(resource.r2Key);
    }

    return {
      ...formatResource(resource),
      downloadUrl,
    };
  });

  // POST /api/resources - Create a new resource (base64 data URL)
  app.post("/api/resources", {
    schema: {
      tags: ["Resources"],
      summary: "Create a new resource with base64 data",
      body: resourceCreateSchema,
      response: {
        201: resourceResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const data = request.body as z.infer<typeof resourceCreateZod>;

    // Verify topic exists and belongs to user
    const topic = await prisma.topic.findFirst({ where: { id: data.topicId, userId } });
    if (!topic) {
      return reply.status(400).send({ error: "invalid_topic", message: "Topic not found or access denied" });
    }

    // Validate file size (20MB max)
    const sizeBytes = Number(data.size);
    if (sizeBytes > 20 * 1024 * 1024) {
      return reply.status(400).send({ error: "file_too_large", message: "File size exceeds 20MB limit" });
    }

    // Validate MIME type
    if (!data.mimeType.startsWith("image/") && data.mimeType !== "application/pdf") {
      return reply.status(400).send({ error: "invalid_type", message: "Only PDF and image files are allowed" });
    }

    // Determine R2 key - use provided or generate one
    const r2Key = data.r2Key || (isR2Configured() ? buildR2Key(userId, crypto.randomUUID(), data.name) : null);

    const resource = await prisma.resource.create({
      data: {
        userId,
        topicId: data.topicId,
        name: data.name,
        mimeType: data.mimeType,
        size: BigInt(sizeBytes),
        data: data.data ?? null,
        r2Key,
      },
    });

    let downloadUrl: string | null = null;
    if (resource.r2Key && isR2Configured()) {
      downloadUrl = await generateDownloadUrl(resource.r2Key);
    }

    return reply.status(201).send({
      ...formatResource(resource),
      downloadUrl,
    });
  });

  // DELETE /api/resources/:id - Delete a resource
  app.delete("/api/resources/:id", {
    schema: {
      tags: ["Resources"],
      summary: "Delete a resource",
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.literal(true) }),
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const existing = await prisma.resource.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Resource not found" });
    }

    // Delete from R2 if using cloud storage
    if (existing.r2Key && isR2Configured()) {
      await deleteObject(existing.r2Key);
    }

    await prisma.resource.delete({ where: { id } });

    return { success: true as const };
  });

  // DELETE /api/resources/topic/:topicId - Delete all resources for a topic
  app.delete("/api/resources/topic/:topicId", {
    schema: {
      tags: ["Resources"],
      summary: "Delete all resources for a topic",
      params: z.object({ topicId: z.string() }),
      response: {
        200: z.object({ success: z.literal(true), deletedCount: z.number() }),
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { topicId } = request.params as { topicId: string };

    // Verify topic belongs to user
    const topic = await prisma.topic.findFirst({ where: { id: topicId, userId } });
    if (!topic) {
      return reply.status(404).send({ error: "not_found", message: "Topic not found or access denied" });
    }

    // Get resources to delete from R2
    const resourcesToDelete = await prisma.resource.findMany({
      where: { topicId, userId },
      select: { r2Key: true },
    });

    // Delete from R2
    if (isR2Configured()) {
      for (const resource of resourcesToDelete) {
        if (resource.r2Key) {
          await deleteObject(resource.r2Key);
        }
      }
    }

    const result = await prisma.resource.deleteMany({
      where: { topicId, userId },
    });

    return { success: true as const, deletedCount: result.count };
  });
}

function formatResource(resource: {
  id: string;
  userId: string;
  topicId: string;
  name: string;
  mimeType: string;
  size: bigint;
  data: string | null;
  r2Key: string | null;
  createdAt: Date;
}) {
  return {
    id: resource.id,
    userId: resource.userId,
    topicId: resource.topicId,
    name: resource.name,
    mimeType: resource.mimeType,
    size: resource.size.toString(),
    data: resource.data,
    r2Key: resource.r2Key,
    createdAt: resource.createdAt.toISOString(),
  };
}