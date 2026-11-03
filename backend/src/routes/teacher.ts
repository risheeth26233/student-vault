import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toJsonSchema } from "../utils/schema.js";
import { prisma } from "../utils/prisma.js";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { canStudentTransition, canTeacherTransition } from "../services/interventionState.js";

const errorSchema = toJsonSchema(z.object({ error: z.string(), message: z.string() }));
const classSchema = toJsonSchema(z.object({ name: z.string().trim().min(1).max(80), subject: z.string().trim().max(40).optional() }));
const joinSchema = toJsonSchema(z.object({ joinCode: z.string().trim().min(12).max(24) }));
const idParamsSchema = toJsonSchema(z.object({ id: z.string().min(1).max(64) }));
const interventionCreateZod = z.object({
  studentId: z.string().min(1).max(64),
  topicId: z.string().min(1).max(64),
  need: z.string().trim().min(1).max(1000),
  action: z.string().trim().min(1).max(1000),
  evidenceSummary: z.string().trim().max(2000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});
const interventionCreateSchema = toJsonSchema(interventionCreateZod);
const interventionStatusSchema = toJsonSchema(z.object({ status: z.enum(["approved", "cancelled"]), outcomeNote: z.string().max(2000).optional() }));
const studentInterventionStatusZod = z.object({ status: z.enum(["in_progress", "completed"]), outcomeNote: z.string().max(2000).optional(), followUpScore: z.number().int().min(0).max(100_000).optional(), followUpMaxScore: z.number().int().min(1).max(100_000).optional() }).superRefine((value, ctx) => {
  if ((value.followUpScore === undefined) !== (value.followUpMaxScore === undefined)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Follow-up score and maximum must be provided together" });
  if (value.followUpScore !== undefined && value.followUpMaxScore !== undefined && value.followUpScore > value.followUpMaxScore) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Follow-up score cannot exceed the maximum" });
});
const studentInterventionStatusSchema = toJsonSchema(studentInterventionStatusZod);
const teacherFeedbackZod = z.object({ feedback: z.string().trim().min(1).max(2000) });
const teacherFeedbackSchema = toJsonSchema(teacherFeedbackZod);
const outcomeReviewZod = z.object({ feedback: z.string().trim().min(1).max(2000), followUpRequired: z.boolean() });
const outcomeReviewSchema = toJsonSchema(outcomeReviewZod);

function currentUser(request: AuthenticatedRequest) {
  return request.dbUser;
}

function isPrismaNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

function staleWrite(reply: import("fastify").FastifyReply) {
  return reply.status(409).send({ error: "stale_intervention", message: "This intervention changed while you were updating it. Reload the latest state and try again." });
}

function roleError(request: AuthenticatedRequest, expected: "teacher" | "student") {
  const user = currentUser(request);
  if (!user) return { status: 401, error: "unauthorized", message: "Authentication required" };
  if (user.role !== expected) return { status: 403, error: "forbidden", message: `${expected} access required` };
  return null;
}

export function createTeacherRoutes(db: typeof prisma = prisma) {
  return async function teacherRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/teacher/classes", { schema: { tags: ["Teacher"], summary: "List classes owned by the teacher", response: { 401: errorSchema, 403: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const classes = await db.classroom.findMany({
      where: { teacherId: request.dbUser!.id }, orderBy: { createdAt: "desc" },
      include: { _count: { select: { enrollments: { where: { status: "active" } } } } },
    });
    return { classes: classes.map((item) => ({ id: item.id, name: item.name, subject: item.subject, joinCode: item.joinCode, activeStudents: item._count.enrollments, createdAt: item.createdAt.toISOString() })) };
  });

  app.post("/api/teacher/classes", { schema: { tags: ["Teacher"], summary: "Create a class", body: classSchema, response: { 201: toJsonSchema(z.object({ id: z.string(), name: z.string(), subject: z.string().nullable(), joinCode: z.string(), createdAt: z.string().datetime() })), 400: errorSchema, 401: errorSchema, 403: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const data = request.body as { name: string; subject?: string };
    const classroom = await db.classroom.create({ data: { teacherId: request.dbUser!.id, name: data.name, subject: data.subject || null, joinCode: randomBytes(9).toString("base64url") } });
    return reply.status(201).send({ id: classroom.id, name: classroom.name, subject: classroom.subject, joinCode: classroom.joinCode, createdAt: classroom.createdAt.toISOString() });
  });

  app.get("/api/teacher/classes/:id/students", { schema: { tags: ["Teacher"], summary: "View enrolled students and observed academic records", params: idParamsSchema, response: { 401: errorSchema, 403: errorSchema, 404: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const { id } = request.params as { id: string };
    const classroom = await db.classroom.findFirst({ where: { id, teacherId: request.dbUser!.id } });
    if (!classroom) return reply.status(404).send({ error: "not_found", message: "Class not found" });
    const enrollments = await db.classroomEnrollment.findMany({
      where: { classroomId: classroom.id, status: "active" },
      select: {
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            topics: {
              where: classroom.subject ? { subject: classroom.subject } : undefined,
              select: { id: true, subject: true, title: true, status: true, updatedAt: true },
              orderBy: { updatedAt: "desc" },
              take: 100,
            },
            assessments: {
              where: classroom.subject ? { subject: classroom.subject } : undefined,
              select: { id: true, title: true, subject: true, topicId: true, score: true, maxScore: true, date: true },
              orderBy: { date: "desc" },
              take: 20,
            },
          },
        },
      },
    });
    const students = enrollments.map(({ createdAt, student }) => ({ id: student.id, name: student.name, enrolledAt: createdAt.toISOString(), topics: student.topics.map((topic) => ({ ...topic, updatedAt: topic.updatedAt.toISOString() })), assessments: student.assessments.map((assessment) => ({ ...assessment, date: assessment.date.toISOString() })), evidenceNotice: classroom.subject ? `This subject class shares ${classroom.subject} records only.` : "This general class shares all recorded topics and assessments after the student joins." }));
    const topicGroups = new Map<string, { subject: string; title: string; studentsWithTopic: number; learning: number; reviewing: number; ready: number; assessmentCount: number; assessmentAveragePercent: number | null; latestAssessmentAt: string | null; latestEvidenceAt: string | null; scoreSum: number }>();
    for (const student of students) {
      const seen = new Set<string>();
      for (const topic of student.topics) {
        const key = `${topic.subject.trim().toLocaleLowerCase()}\u0000${topic.title.trim().toLocaleLowerCase()}`;
        const aggregate = topicGroups.get(key) ?? { subject: topic.subject, title: topic.title, studentsWithTopic: 0, learning: 0, reviewing: 0, ready: 0, assessmentCount: 0, assessmentAveragePercent: null, latestAssessmentAt: null, latestEvidenceAt: null, scoreSum: 0 };
        if (!seen.has(key)) { aggregate.studentsWithTopic += 1; seen.add(key); }
        aggregate[topic.status] += 1;
        if (!aggregate.latestEvidenceAt || topic.updatedAt > aggregate.latestEvidenceAt) aggregate.latestEvidenceAt = topic.updatedAt;
        for (const assessment of student.assessments.filter((item) => item.topicId === topic.id && item.maxScore > 0)) {
          aggregate.assessmentCount += 1;
          aggregate.scoreSum += (assessment.score / assessment.maxScore) * 100;
          if (!aggregate.latestAssessmentAt || assessment.date > aggregate.latestAssessmentAt) aggregate.latestAssessmentAt = assessment.date;
          if (!aggregate.latestEvidenceAt || assessment.date > aggregate.latestEvidenceAt) aggregate.latestEvidenceAt = assessment.date;
        }
        if (aggregate.assessmentCount > 0) aggregate.assessmentAveragePercent = Math.round(aggregate.scoreSum / aggregate.assessmentCount);
        topicGroups.set(key, aggregate);
      }
    }
    const staleAfterMs = 90 * 24 * 60 * 60 * 1000;
    const topicSummary = [...topicGroups.values()].map(({ scoreSum: _scoreSum, ...summary }) => ({
      ...summary,
      evidenceFreshness: !summary.latestEvidenceAt ? "none" as const : Date.now() - new Date(summary.latestEvidenceAt).getTime() > staleAfterMs ? "stale" as const : "recent" as const,
      observedSignal: summary.learning > 0 || (summary.assessmentAveragePercent !== null && summary.assessmentAveragePercent < 60) ? "review_indicated" as const : summary.assessmentCount === 0 ? "insufficient_evidence" as const : "no_flagged_signal" as const,
    })).sort((a, b) => b.learning - a.learning || a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title));
    return { students, topicSummary, summaryNotice: "Counts and assessment averages are computed from saved topic and assessment records for active class members. A review indication means at least one topic is marked learning or the recorded assessment average is below 60%; no such diagnosis or GuruGraph mastery is inferred. Evidence is marked stale after 90 days. Missing assessment records are reported explicitly." };
  });

  app.post("/api/teacher/enrollments/accept", { schema: { tags: ["Teacher"], summary: "Join a class using a teacher-shared code", body: joinSchema, response: { 201: toJsonSchema(z.object({ success: z.literal(true), className: z.string(), subject: z.string().nullable() })), 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "student");
    if (denied) return reply.status(denied.status).send(denied);
    const { joinCode } = request.body as { joinCode: string };
    const classroom = await db.classroom.findUnique({ where: { joinCode } });
    if (!classroom) return reply.status(404).send({ error: "not_found", message: "Class code not found" });
    await db.classroomEnrollment.upsert({
      where: { classroomId_studentId: { classroomId: classroom.id, studentId: request.dbUser!.id } },
      create: { classroomId: classroom.id, studentId: request.dbUser!.id, status: "active" },
      update: { status: "active" },
    });
    return reply.status(201).send({ success: true as const, className: classroom.name, subject: classroom.subject });
  });

  app.post("/api/teacher/classes/:id/interventions", { schema: { tags: ["Interventions"], summary: "Propose a follow-up action for an enrolled student", params: idParamsSchema, body: interventionCreateSchema, response: { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const { id: classroomId } = request.params as { id: string };
    const data = request.body as z.infer<typeof interventionCreateZod>;
    const classroom = await db.classroom.findFirst({ where: { id: classroomId, teacherId: request.dbUser!.id }, select: { id: true } });
    if (!classroom) return reply.status(404).send({ error: "not_found", message: "Class not found" });
    const enrollment = await db.classroomEnrollment.findUnique({ where: { classroomId_studentId: { classroomId, studentId: data.studentId } }, select: { status: true } });
    if (enrollment?.status !== "active") return reply.status(404).send({ error: "not_found", message: "Enrolled student not found" });
    if (!await db.topic.findFirst({ where: { id: data.topicId, userId: data.studentId }, select: { id: true } })) {
      return reply.status(400).send({ error: "invalid_topic", message: "The topic is not owned by the selected student" });
    }
    const baseline = await db.assessment.findFirst({ where: { userId: data.studentId, topicId: data.topicId }, orderBy: { date: "desc" }, select: { score: true, maxScore: true } });
    const record = await db.intervention.create({ data: {
      classroomId, studentId: data.studentId, authorId: request.dbUser!.id,
      topicId: data.topicId, need: data.need, action: data.action,
      evidenceSummary: data.evidenceSummary || null, dueAt: data.dueAt ? new Date(data.dueAt) : null,
      baselineScore: baseline?.score ?? null, baselineMaxScore: baseline?.maxScore ?? null,
      events: { create: { actorId: request.dbUser!.id, fromStatus: null, toStatus: "proposed" } },
    } });
    return reply.status(201).send(record);
  });

  app.get("/api/teacher/classes/:id/interventions", { schema: { tags: ["Interventions"], summary: "List interventions for a teacher-owned class", params: idParamsSchema, response: { 401: errorSchema, 403: errorSchema, 404: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const { id: classroomId } = request.params as { id: string };
    if (!await db.classroom.findFirst({ where: { id: classroomId, teacherId: request.dbUser!.id }, select: { id: true } })) {
      return reply.status(404).send({ error: "not_found", message: "Class not found" });
    }
    const interventions = await db.intervention.findMany({
      where: { classroomId }, orderBy: { createdAt: "desc" },
      include: { student: { select: { id: true, name: true } }, topic: { select: { id: true, subject: true, title: true } }, events: { orderBy: { createdAt: "asc" } } },
    });
    return { interventions };
  });

  app.patch("/api/teacher/interventions/:id", { schema: { tags: ["Interventions"], summary: "Approve or cancel a proposed intervention", params: idParamsSchema, body: interventionStatusSchema, response: { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const { id } = request.params as { id: string };
    const body = request.body as { status: "approved" | "cancelled"; outcomeNote?: string };
    const current = await db.intervention.findFirst({ where: { id, classroom: { teacherId: request.dbUser!.id } } });
    if (!current) return reply.status(404).send({ error: "not_found", message: "Intervention not found" });
    if (!canTeacherTransition(current.status, body.status)) return reply.status(400).send({ error: "invalid_transition", message: "This intervention cannot make that status transition" });
    try {
      return await db.intervention.update({ where: { id, status: current.status }, data: { status: body.status, ...(body.outcomeNote !== undefined ? { outcomeNote: body.outcomeNote } : {}), events: { create: { actorId: request.dbUser!.id, fromStatus: current.status, toStatus: body.status, ...(body.outcomeNote !== undefined ? { note: body.outcomeNote } : {}) } } } });
    } catch (error) {
      if (isPrismaNotFound(error)) return staleWrite(reply);
      throw error;
    }
  });

  app.post("/api/teacher/interventions/:id/feedback", { schema: { tags: ["Interventions"], summary: "Add teacher feedback to an active or completed intervention", params: idParamsSchema, body: teacherFeedbackSchema, response: { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const { id } = request.params as { id: string };
    const { feedback } = request.body as z.infer<typeof teacherFeedbackZod>;
    const current = await db.intervention.findFirst({ where: { id, classroom: { teacherId: request.dbUser!.id } } });
    if (!current) return reply.status(404).send({ error: "not_found", message: "Intervention not found" });
    if (!["in_progress", "completed"].includes(current.status)) return reply.status(400).send({ error: "invalid_review", message: "Feedback is available after the student starts the intervention" });
    try {
      return await db.intervention.update({ where: { id, status: current.status }, data: { teacherFeedback: feedback, events: { create: { actorId: request.dbUser!.id, fromStatus: current.status, toStatus: current.status, note: feedback } } } });
    } catch (error) {
      if (isPrismaNotFound(error)) return staleWrite(reply);
      throw error;
    }
  });

  app.post("/api/teacher/interventions/:id/review", { schema: { tags: ["Interventions"], summary: "Review a completed intervention and record follow-up decision", params: idParamsSchema, body: outcomeReviewSchema, response: { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "teacher");
    if (denied) return reply.status(denied.status).send(denied);
    const { id } = request.params as { id: string };
    const { feedback, followUpRequired } = request.body as z.infer<typeof outcomeReviewZod>;
    const current = await db.intervention.findFirst({ where: { id, classroom: { teacherId: request.dbUser!.id } } });
    if (!current) return reply.status(404).send({ error: "not_found", message: "Intervention not found" });
    if (current.status !== "completed") return reply.status(400).send({ error: "not_completed", message: "Only completed student responses can be reviewed" });
    if (current.reviewedAt) return reply.status(400).send({ error: "already_reviewed", message: "This response already has a recorded teacher review" });
    try {
      return await db.intervention.update({ where: { id, status: "completed", reviewedAt: null }, data: { teacherFeedback: feedback, followUpRequired, reviewedAt: new Date(), events: { create: { actorId: request.dbUser!.id, fromStatus: "completed", toStatus: "completed", note: `Teacher review: ${feedback}\nFollow-up required: ${followUpRequired}` } } } });
    } catch (error) {
      if (isPrismaNotFound(error)) return staleWrite(reply);
      throw error;
    }
  });

  app.get("/api/student/interventions", { schema: { tags: ["Interventions"], summary: "List the current student's intervention plans", response: { 401: errorSchema, 403: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "student");
    if (denied) return reply.status(denied.status).send(denied);
    const interventions = await db.intervention.findMany({
      where: { studentId: request.dbUser!.id, status: { in: ["approved", "in_progress", "completed"] } }, orderBy: { createdAt: "desc" },
      include: { classroom: { select: { name: true } }, topic: { select: { id: true, subject: true, title: true } }, author: { select: { name: true } }, events: { orderBy: { createdAt: "asc" } } },
    });
    return { interventions };
  });

  app.patch("/api/student/interventions/:id", { schema: { tags: ["Interventions"], summary: "Start or complete the student's intervention action", params: idParamsSchema, body: studentInterventionStatusSchema, response: { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema } } }, async (request: AuthenticatedRequest, reply) => {
    const denied = roleError(request, "student");
    if (denied) return reply.status(denied.status).send(denied);
    const { id } = request.params as { id: string };
    const body = request.body as z.infer<typeof studentInterventionStatusZod>;
    const current = await db.intervention.findFirst({ where: { id, studentId: request.dbUser!.id } });
    if (!current) return reply.status(404).send({ error: "not_found", message: "Intervention not found" });
    if (!canStudentTransition(current.status, body.status)) return reply.status(400).send({ error: "invalid_transition", message: "Complete intervention steps in order: approved, in progress, completed" });
    if (body.status === "completed" && !body.outcomeNote?.trim()) return reply.status(400).send({ error: "outcome_required", message: "Add a short note about what you completed before closing the plan" });
    if (body.status === "completed" && current.topicId && (body.followUpScore === undefined || body.followUpMaxScore === undefined)) return reply.status(400).send({ error: "reassessment_required", message: "Record a follow-up score and maximum for this topic-linked plan" });
    if (body.followUpScore !== undefined && body.followUpMaxScore !== undefined && !current.topicId) return reply.status(400).send({ error: "topic_required", message: "A topic-linked plan is required to record a reassessment score" });
    try {
      return await db.$transaction(async (tx) => {
      const updated = await tx.intervention.update({ where: { id, status: current.status }, data: { status: body.status, ...(body.outcomeNote !== undefined ? { outcomeNote: body.outcomeNote } : {}), ...(body.followUpScore !== undefined ? { followUpScore: body.followUpScore, followUpMaxScore: body.followUpMaxScore } : {}), ...(body.status === "completed" ? { completedAt: new Date() } : {}), events: { create: { actorId: request.dbUser!.id, fromStatus: current.status, toStatus: body.status, ...(body.outcomeNote !== undefined ? { note: body.outcomeNote } : {}) } } } });
      if (body.status === "completed" && body.followUpScore !== undefined && body.followUpMaxScore !== undefined && current.topicId) {
        const topic = await tx.topic.findFirst({ where: { id: current.topicId, userId: current.studentId }, select: { subject: true, title: true } });
        if (!topic) throw new Error("Intervention topic is no longer available");
        await tx.assessment.create({ data: {
          userId: current.studentId,
          title: `Intervention reassessment: ${topic.title}`.slice(0, 120),
          subject: topic.subject,
          topicId: current.topicId,
          type: "quiz",
          score: body.followUpScore,
          maxScore: body.followUpMaxScore,
          date: new Date(),
        } });
      }
      return updated;
      });
    } catch (error) {
      if (isPrismaNotFound(error)) return staleWrite(reply);
      throw error;
    }
  });
  };
}

export const teacherRoutes = createTeacherRoutes();
