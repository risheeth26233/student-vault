import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { getDbUserId, type AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { toJsonSchema } from "../utils/schema.js";

const ASSIGNMENT_STATUSES = ["pending", "in_progress", "completed"] as const;
const ASSIGNMENT_PRIORITIES = ["low", "medium", "high"] as const;

const assignmentStatusZod = z.enum(ASSIGNMENT_STATUSES);
const assignmentPriorityZod = z.enum(ASSIGNMENT_PRIORITIES);

const assignmentCreateZod = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  subject: z.string().trim().min(1).max(40),
  topicId: z.string().min(1).max(64).nullable().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  status: assignmentStatusZod.optional().default("pending"),
  priority: assignmentPriorityZod.optional().default("medium"),
});

const assignmentUpdateZod = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  subject: z.string().trim().min(1).max(40).optional(),
  topicId: z.string().min(1).max(64).nullable().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  status: assignmentStatusZod.optional(),
  priority: assignmentPriorityZod.optional(),
});

const assignmentResponseZod = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string(),
  subject: z.string(),
  topicId: z.string().nullable(),
  dueDate: z.string().datetime().nullable(),
  status: assignmentStatusZod,
  priority: assignmentPriorityZod,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const assignmentsListResponseZod = z.object({
  assignments: z.array(assignmentResponseZod),
  total: z.number(),
});

const errorResponseZod = z.object({ error: z.string(), message: z.string() });

const assignmentCreateSchema = toJsonSchema(assignmentCreateZod);
const assignmentUpdateSchema = toJsonSchema(assignmentUpdateZod);
const assignmentResponseSchema = toJsonSchema(assignmentResponseZod);
const assignmentsListResponseSchema = toJsonSchema(assignmentsListResponseZod);
const errorResponseSchema = toJsonSchema(errorResponseZod);

const assignmentParamsZod = z.object({ id: z.string() });
const assignmentParamsSchema = toJsonSchema(assignmentParamsZod);

/**
 * Verify that a client-supplied topic actually belongs to this user and that
 * its subject matches the assignment subject. Returns a Fastify-style error
 * payload when the relationship cannot be trusted.
 */
async function checkTopicRelationship(
  userId: string,
  topicId: string | null | undefined,
  subject: string
): Promise<{ error: string; message: string } | null> {
  if (!topicId) return null;
  const topic = await prisma.topic.findFirst({ where: { id: topicId, userId } });
  if (!topic) {
    return { error: "invalid_topic", message: "The selected topic does not exist" };
  }
  if (topic.subject !== subject) {
    return {
      error: "subject_mismatch",
      message: `That topic belongs to ${topic.subject}, not ${subject}`,
    };
  }
  return null;
}

export async function assignmentsRoutes(app: FastifyInstance): Promise<void> {
  const assignmentsQuerystringZod = z.object({
    subject: z.string().min(1).max(40).optional(),
    topicId: z.string().min(1).max(64).optional(),
    status: assignmentStatusZod.optional(),
    priority: assignmentPriorityZod.optional(),
    search: z.string().max(120).optional(),
    dueBefore: z.string().datetime().optional(),
    dueAfter: z.string().datetime().optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(50),
    offset: z.coerce.number().min(0).optional().default(0),
  });
  const assignmentsQuerystringSchema = toJsonSchema(assignmentsQuerystringZod);

  // GET /api/assignments - List assignments for the authenticated user
  app.get("/api/assignments", {
    schema: {
      tags: ["Assignments"],
      summary: "List assignments",
      querystring: assignmentsQuerystringSchema,
      response: {
        200: assignmentsListResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { subject, topicId, status, priority, search, dueBefore, dueAfter, limit, offset } =
      request.query as z.infer<typeof assignmentsQuerystringZod>;

    const where: Record<string, unknown> = { userId };
    if (subject) where.subject = subject;
    if (topicId) where.topicId = topicId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (dueBefore || dueAfter) {
      where.dueDate = {
        ...(dueBefore ? { lte: new Date(dueBefore) } : {}),
        ...(dueAfter ? { gte: new Date(dueAfter) } : {}),
      };
    }

    const [assignments, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        // Postgres sorts NULL due dates last for ascending order.
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.assignment.count({ where }),
    ]);

    return {
      assignments: assignments.map(formatAssignment),
      total,
    };
  });

  // GET /api/assignments/:id - Get a single assignment
  app.get("/api/assignments/:id", {
    schema: {
      tags: ["Assignments"],
      summary: "Get an assignment by ID",
      params: assignmentParamsSchema,
      response: {
        200: assignmentResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const assignment = await prisma.assignment.findFirst({ where: { id, userId } });

    if (!assignment) {
      return reply.status(404).send({ error: "not_found", message: "Assignment not found" });
    }

    return formatAssignment(assignment);
  });

  // POST /api/assignments - Create a new assignment
  app.post("/api/assignments", {
    schema: {
      tags: ["Assignments"],
      summary: "Create a new assignment",
      body: assignmentCreateSchema,
      response: {
        201: assignmentResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const data = request.body as z.infer<typeof assignmentCreateZod>;

    const topicError = await checkTopicRelationship(userId, data.topicId, data.subject);
    if (topicError) return reply.status(400).send(topicError);

    const assignment = await prisma.assignment.create({
      data: {
        userId,
        title: data.title,
        description: data.description ?? "",
        subject: data.subject,
        topicId: data.topicId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status ?? "pending",
        priority: data.priority ?? "medium",
      },
    });

    return reply.status(201).send(formatAssignment(assignment));
  });

  // PUT /api/assignments/:id - Update an assignment
  app.put("/api/assignments/:id", {
    schema: {
      tags: ["Assignments"],
      summary: "Update an assignment",
      params: assignmentParamsSchema,
      body: assignmentUpdateSchema,
      response: {
        200: assignmentResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const data = request.body as z.infer<typeof assignmentUpdateZod>;

    const existing = await prisma.assignment.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Assignment not found" });
    }

    // Resolve the effective values so relationships are validated as a whole.
    const nextSubject = data.subject ?? existing.subject;
    const nextTopicId = data.topicId !== undefined ? data.topicId : existing.topicId;

    const topicError = await checkTopicRelationship(userId, nextTopicId, nextSubject);
    if (topicError) return reply.status(400).send(topicError);

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.topicId !== undefined) updateData.topicId = data.topicId;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;

    const assignment = await prisma.assignment.update({
      where: { id },
      data: updateData,
    });

    return formatAssignment(assignment);
  });

  // DELETE /api/assignments/:id - Delete an assignment
  app.delete("/api/assignments/:id", {
    schema: {
      tags: ["Assignments"],
      summary: "Delete an assignment",
      params: assignmentParamsSchema,
      response: {
        200: toJsonSchema(z.object({ success: z.literal(true) })),
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const existing = await prisma.assignment.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Assignment not found" });
    }

    await prisma.assignment.delete({ where: { id } });

    return { success: true as const };
  });
}

function formatAssignment(assignment: {
  id: string;
  userId: string;
  title: string;
  description: string;
  subject: string;
  topicId: string | null;
  dueDate: Date | null;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: assignment.id,
    userId: assignment.userId,
    title: assignment.title,
    description: assignment.description,
    subject: assignment.subject,
    topicId: assignment.topicId,
    dueDate: assignment.dueDate?.toISOString() ?? null,
    status: assignment.status,
    priority: assignment.priority,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  };
}
