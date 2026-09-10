import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "../utils/prisma.js";
import { getDbUserId, type AuthenticatedRequest } from "../plugins/clerk-auth.js";

const checklistZod = z.object({
  understand: z.boolean(),
  practice: z.boolean(),
  revise: z.boolean(),
});

const topicCreateZod = z.object({
  subject: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  examDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().default(""),
  status: z.enum(["learning", "reviewing", "ready"]).optional().default("learning"),
  checklist: checklistZod.optional(),
});

const topicUpdateZod = z.object({
  subject: z.string().min(1).max(40).optional(),
  title: z.string().min(1).max(80).optional(),
  examDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
  status: z.enum(["learning", "reviewing", "ready"]).optional(),
  checklist: checklistZod.optional(),
});

const topicResponseZod = z.object({
  id: z.string(),
  userId: z.string(),
  subject: z.string(),
  title: z.string(),
  examDate: z.string().datetime().nullable(),
  notes: z.string(),
  status: z.enum(["learning", "reviewing", "ready"]),
  checklist: checklistZod,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const topicsListResponseZod = z.object({
  topics: z.array(topicResponseZod),
  total: z.number(),
});

const errorResponseZod = z.object({ error: z.string(), message: z.string() });

const topicCreateSchema = zodToJsonSchema(topicCreateZod);
const topicUpdateSchema = zodToJsonSchema(topicUpdateZod);
const topicResponseSchema = zodToJsonSchema(topicResponseZod);
const topicsListResponseSchema = zodToJsonSchema(topicsListResponseZod);
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

export async function topicsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/topics - List all topics for the authenticated user
  app.get("/api/topics", {
    schema: {
      tags: ["Topics"],
      summary: "List all topics",
      querystring: z.object({
        subject: z.string().optional(),
        status: z.enum(["learning", "reviewing", "ready"]).optional(),
        search: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).optional().default(50),
        offset: z.coerce.number().min(0).optional().default(0),
      }),
      response: {
        200: topicsListResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { subject, status, search, limit, offset } = request.query as {
      subject?: string;
      status?: "learning" | "reviewing" | "ready";
      search?: string;
      limit: number;
      offset: number;
    };

    const where: Record<string, unknown> = { userId };
    if (subject) where.subject = subject;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const [topics, total] = await Promise.all([
      prisma.topic.findMany({
        where,
        orderBy: [{ examDate: "asc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.topic.count({ where }),
    ]);

    return {
      topics: topics.map(formatTopic),
      total,
    };
  });

  // GET /api/topics/:id - Get a single topic
  app.get("/api/topics/:id", {
    schema: {
      tags: ["Topics"],
      summary: "Get a topic by ID",
      params: z.object({ id: z.string() }),
      response: {
        200: topicResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const topic = await prisma.topic.findFirst({ where: { id, userId } });

    if (!topic) {
      return reply.status(404).send({ error: "not_found", message: "Topic not found" });
    }

    return formatTopic(topic);
  });

  // POST /api/topics - Create a new topic
  app.post("/api/topics", {
    schema: {
      tags: ["Topics"],
      summary: "Create a new topic",
      body: topicCreateSchema,
      response: {
        201: topicResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const data = request.body as z.infer<typeof topicCreateZod>;
    const topic = await prisma.topic.create({
      data: {
        userId,
        subject: data.subject,
        title: data.title,
        examDate: data.examDate ? new Date(data.examDate) : null,
        notes: data.notes ?? "",
        status: data.status ?? "learning",
        checklist: data.checklist ?? { understand: false, practice: false, revise: false },
      },
    });

    return reply.status(201).send(formatTopic(topic));
  });

  // PUT /api/topics/:id - Update a topic
  app.put("/api/topics/:id", {
    schema: {
      tags: ["Topics"],
      summary: "Update a topic",
      params: z.object({ id: z.string() }),
      body: topicUpdateSchema,
      response: {
        200: topicResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const data = request.body as z.infer<typeof topicUpdateZod>;

    const existing = await prisma.topic.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Topic not found" });
    }

    const updateData: Record<string, unknown> = {};
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.examDate !== undefined) updateData.examDate = data.examDate ? new Date(data.examDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.checklist !== undefined) updateData.checklist = data.checklist;

    const topic = await prisma.topic.update({
      where: { id },
      data: updateData,
    });

    return formatTopic(topic);
  });

  // PATCH /api/topics/:id/checklist - Update checklist only
  app.patch("/api/topics/:id/checklist", {
    schema: {
      tags: ["Topics"],
      summary: "Update topic checklist",
      params: z.object({ id: z.string() }),
      body: checklistZod,
      response: {
        200: topicResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const checklist = request.body as z.infer<typeof checklistZod>;

    const existing = await prisma.topic.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Topic not found" });
    }

    const topic = await prisma.topic.update({
      where: { id },
      data: { checklist },
    });

    return formatTopic(topic);
  });

  // DELETE /api/topics/:id - Delete a topic
  app.delete("/api/topics/:id", {
    schema: {
      tags: ["Topics"],
      summary: "Delete a topic and its resources",
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.literal(true) }),
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const existing = await prisma.topic.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Topic not found" });
    }

    // Cascade delete resources via Prisma relation
    await prisma.topic.delete({ where: { id } });

    return { success: true as const };
  });
}

function formatTopic(topic: {
  id: string;
  userId: string;
  subject: string;
  title: string;
  examDate: Date | null;
  notes: string;
  status: "learning" | "reviewing" | "ready";
  checklist: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const checklist = topic.checklist as { understand: boolean; practice: boolean; revise: boolean } | null;
  return {
    id: topic.id,
    userId: topic.userId,
    subject: topic.subject,
    title: topic.title,
    examDate: topic.examDate?.toISOString() ?? null,
    notes: topic.notes,
    status: topic.status,
    checklist: checklist ?? { understand: false, practice: false, revise: false },
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}