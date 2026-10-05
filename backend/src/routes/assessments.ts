import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { getDbUserId, type AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { toJsonSchema } from "../utils/schema.js";

const ASSESSMENT_TYPES = ["quiz", "test", "exam", "assignment", "other"] as const;

const assessmentTypeZod = z.enum(ASSESSMENT_TYPES);

const assessmentCreateZod = z.object({
  title: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(40),
  topicId: z.string().min(1).max(64).nullable().optional(),
  type: assessmentTypeZod.optional().default("exam"),
  score: z.number().int().min(0).max(100000),
  maxScore: z.number().int().min(1).max(100000),
  date: z.string().datetime(),
});

const assessmentUpdateZod = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  subject: z.string().trim().min(1).max(40).optional(),
  topicId: z.string().min(1).max(64).nullable().optional(),
  type: assessmentTypeZod.optional(),
  score: z.number().int().min(0).max(100000).optional(),
  maxScore: z.number().int().min(1).max(100000).optional(),
  date: z.string().datetime().optional(),
});

const assessmentResponseZod = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  subject: z.string(),
  topicId: z.string().nullable(),
  type: assessmentTypeZod,
  score: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  date: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const assessmentsListResponseZod = z.object({
  assessments: z.array(assessmentResponseZod),
  total: z.number(),
});

const errorResponseZod = z.object({ error: z.string(), message: z.string() });

const assessmentCreateSchema = toJsonSchema(assessmentCreateZod);
const assessmentUpdateSchema = toJsonSchema(assessmentUpdateZod);
const assessmentResponseSchema = toJsonSchema(assessmentResponseZod);
const assessmentsListResponseSchema = toJsonSchema(assessmentsListResponseZod);
const errorResponseSchema = toJsonSchema(errorResponseZod);
const assessmentParamsSchema = toJsonSchema(z.object({ id: z.string() }));

interface AssessmentRow {
  id: string;
  userId: string;
  title: string;
  subject: string;
  topicId: string | null;
  type: "quiz" | "test" | "exam" | "assignment" | "other";
  score: number;
  maxScore: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

function formatAssessment(row: AssessmentRow) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    subject: row.subject,
    topicId: row.topicId,
    type: row.type,
    score: row.score,
    maxScore: row.maxScore,
    percentage: row.maxScore > 0 ? Math.round((row.score * 1000) / row.maxScore) / 10 : 0,
    date: row.date.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Verify that a client-supplied topic belongs to this user and that its subject
 * matches the assessment subject. Mirrors the assignments route.
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

export async function assessmentsRoutes(app: FastifyInstance): Promise<void> {
  const assessmentsQuerystringZod = z.object({
    subject: z.string().min(1).max(40).optional(),
    topicId: z.string().min(1).max(64).optional(),
    type: assessmentTypeZod.optional(),
    search: z.string().max(120).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    limit: z.coerce.number().min(1).max(200).optional().default(100),
    offset: z.coerce.number().min(0).optional().default(0),
  });
  const assessmentsQuerystringSchema = toJsonSchema(assessmentsQuerystringZod);

  // GET /api/assessments - List assessments for the authenticated user
  app.get("/api/assessments", {
    schema: {
      tags: ["Assessments"],
      summary: "List assessments",
      querystring: assessmentsQuerystringSchema,
      response: {
        200: assessmentsListResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { subject, topicId, type, search, dateFrom, dateTo, limit, offset } =
      request.query as z.infer<typeof assessmentsQuerystringZod>;

    const where: Record<string, unknown> = { userId };
    if (subject) where.subject = subject;
    if (topicId) where.topicId = topicId;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ];
    }
    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.assessment.count({ where }),
    ]);

    return { assessments: assessments.map(formatAssessment), total };
  });

  // GET /api/assessments/:id - Get a single assessment
  app.get("/api/assessments/:id", {
    schema: {
      tags: ["Assessments"],
      summary: "Get an assessment by ID",
      params: assessmentParamsSchema,
      response: {
        200: assessmentResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const assessment = await prisma.assessment.findFirst({ where: { id, userId } });
    if (!assessment) {
      return reply.status(404).send({ error: "not_found", message: "Assessment not found" });
    }
    return formatAssessment(assessment);
  });

  // POST /api/assessments - Create a new assessment
  app.post("/api/assessments", {
    schema: {
      tags: ["Assessments"],
      summary: "Create a new assessment",
      body: assessmentCreateSchema,
      response: {
        201: assessmentResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const data = request.body as z.infer<typeof assessmentCreateZod>;

    if (data.score > data.maxScore) {
      return reply.status(400).send({
        error: "invalid_score",
        message: "Score cannot be higher than the maximum score",
      });
    }

    const topicError = await checkTopicRelationship(userId, data.topicId, data.subject);
    if (topicError) return reply.status(400).send(topicError);

    const assessment = await prisma.assessment.create({
      data: {
        userId,
        title: data.title,
        subject: data.subject,
        topicId: data.topicId ?? null,
        type: data.type ?? "exam",
        score: data.score,
        maxScore: data.maxScore,
        date: new Date(data.date),
      },
    });

    return reply.status(201).send(formatAssessment(assessment));
  });

  // PUT /api/assessments/:id - Update an assessment
  app.put("/api/assessments/:id", {
    schema: {
      tags: ["Assessments"],
      summary: "Update an assessment",
      params: assessmentParamsSchema,
      body: assessmentUpdateSchema,
      response: {
        200: assessmentResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const data = request.body as z.infer<typeof assessmentUpdateZod>;

    const existing = await prisma.assessment.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Assessment not found" });
    }

    const nextSubject = data.subject ?? existing.subject;
    const nextTopicId = data.topicId !== undefined ? data.topicId : existing.topicId;
    const nextScore = data.score ?? existing.score;
    const nextMax = data.maxScore ?? existing.maxScore;

    if (nextScore > nextMax) {
      return reply.status(400).send({
        error: "invalid_score",
        message: "Score cannot be higher than the maximum score",
      });
    }

    const topicError = await checkTopicRelationship(userId, nextTopicId, nextSubject);
    if (topicError) return reply.status(400).send(topicError);

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.topicId !== undefined) updateData.topicId = data.topicId;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.score !== undefined) updateData.score = data.score;
    if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;
    if (data.date !== undefined) updateData.date = new Date(data.date);

    const assessment = await prisma.assessment.update({ where: { id }, data: updateData });
    return formatAssessment(assessment);
  });

  // DELETE /api/assessments/:id - Delete an assessment
  app.delete("/api/assessments/:id", {
    schema: {
      tags: ["Assessments"],
      summary: "Delete an assessment",
      params: assessmentParamsSchema,
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
    const existing = await prisma.assessment.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Assessment not found" });
    }

    await prisma.assessment.delete({ where: { id } });
    return { success: true as const };
  });
}
