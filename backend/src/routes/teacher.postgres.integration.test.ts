import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { createTeacherRoutes } from "./teacher.js";
import { createSyncRoutes } from "./sync.js";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_TEST_URL;

if (enabled) {
  if (!databaseUrl) throw new Error("DATABASE_TEST_URL is required when RUN_DATABASE_INTEGRATION_TESTS=1");
  const target = new URL(databaseUrl);
  const host = target.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const database = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(host) || database !== "student_vault_test") {
    throw new Error("Database integration tests only accept loopback PostgreSQL database student_vault_test; the configured URL was not used");
  }
}

type Actor = { id: string; email: string; name: string; role: "teacher" | "student" };

function createApp(db: PrismaClient, actors: Actor[]) {
  const app = Fastify({ logger: false });
  const byId = new Map(actors.map((actor) => [actor.id, actor]));
  app.addHook("preHandler", async (request) => {
    const actorId = request.headers["x-integration-actor"];
    if (typeof actorId === "string") {
      const actor = byId.get(actorId);
      if (actor) (request as AuthenticatedRequest).dbUser = actor;
    }
  });
  app.register(createTeacherRoutes(db));
  app.register(createSyncRoutes(db));
  return app;
}

test("PostgreSQL teacher, enrollment, reassessment, and rollback integration", {
  skip: enabled ? false : "Set RUN_DATABASE_INTEGRATION_TESTS=1 and a loopback DATABASE_TEST_URL for student_vault_test",
}, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  const suffix = randomUUID();
  const clerkIds = ["teacher", "other-teacher", "student", "outsider"].map((label) => `db-integration-${label}-${suffix}`);
  const actors: Actor[] = [];
  let app: FastifyInstance | undefined;

  try {
    await db.$connect();
    const identity = await db.$queryRaw<Array<{ database_name: string; server_addr: string | null }>>`
      SELECT current_database() AS database_name, inet_server_addr()::text AS server_addr
    `;
    assert.equal(identity[0]?.database_name, "student_vault_test");
    const serverAddress = identity[0]?.server_addr?.replace(/^\[|\]$/g, "");
    assert.ok(serverAddress === "::1" || serverAddress === "127.0.0.1" || serverAddress?.startsWith("127.") || serverAddress?.startsWith("::ffff:127."), "PostgreSQL connection must terminate on loopback");

    const applied = await db.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    const migrationNames = new Set(applied.map((row) => row.migration_name));
    assert.ok(migrationNames.has("20261028120000_initial_schema"), "initial schema migration must be applied first");
    assert.ok(migrationNames.has("20261028130000_teacher_and_intervention_foundation"), "teacher/intervention migration must be applied");

    const createActor = async (index: number, role: Actor["role"]): Promise<Actor> => {
      const clerkId = clerkIds[index]!;
      const user = await db.user.create({
        data: { clerkId, email: `${clerkId}@student-vault.test`, name: role === "teacher" ? "Integration Teacher" : "Integration Student", role },
      });
      const actor: Actor = { id: user.id, email: user.email, name: user.name, role: user.role };
      actors.push(actor);
      return actor;
    };

    const [teacher, otherTeacher, student, outsider] = await Promise.all([
      createActor(0, "teacher"), createActor(1, "teacher"), createActor(2, "student"), createActor(3, "student"),
    ]);
    app = createApp(db, actors);

    const topic = await db.topic.create({ data: {
      userId: student.id, subject: "Mathematics", title: `Integration fractions ${suffix.slice(0, 8)}`,
      notes: "Test evidence only", status: "learning", checklist: { understand: false, practice: false, revise: false },
    } });
    await db.assessment.create({ data: {
      userId: student.id, topicId: topic.id, title: "Integration baseline", subject: topic.subject,
      type: "quiz", score: 4, maxScore: 10, date: new Date(),
    } });

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const inline = `data:image/png;base64,${png.toString("base64")}`;
    const subjectId = `sync-subject-${suffix}`;
    const recordId = `sync-record-${suffix}`;
    const syncPayload = {
      topics: [], attendanceSubjects: [{ id: subjectId, name: "Sync test", records: [{ id: recordId, record: "present" }] }],
      resources: [{ id: `sync-resource-${suffix}`, topicId: topic.id, name: "page.png", mimeType: "image/png", size: png.length, data: inline }],
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const pushed: { statusCode: number; body: string; json(): { success: boolean } } = await app.inject({ method: "POST", url: "/api/sync/push", headers: { "x-integration-actor": student.id }, payload: { ...syncPayload, clientVersion: Date.now() } });
      assert.equal(pushed.statusCode, 200, pushed.body);
      assert.equal(pushed.json().success, true);
    }
    assert.equal(await db.attendanceRecord.count({ where: { attendanceSubjectId: subjectId } }), 1, "repeated sync must not duplicate attendance");
    const pulled = await app.inject({ method: "POST", url: "/api/sync/pull", headers: { "x-integration-actor": student.id } });
    assert.equal(pulled.statusCode, 200, pulled.body);
    assert.equal(pulled.json().resources[0].data, inline, "inline bytes must survive sync serialization");
    const foreignPull = await app.inject({ method: "POST", url: "/api/sync/pull", headers: { "x-integration-actor": outsider.id } });
    assert.equal(foreignPull.json().resources.length, 0);

    const createdClass = await app.inject({
      method: "POST", url: "/api/teacher/classes", headers: { "x-integration-actor": teacher.id },
      payload: { name: `Integration class ${suffix.slice(0, 8)}`, subject: topic.subject },
    });
    assert.equal(createdClass.statusCode, 201, createdClass.body);
    const classroom = createdClass.json<{ id: string; joinCode: string }>();

    const join = await app.inject({ method: "POST", url: "/api/teacher/enrollments/accept", headers: { "x-integration-actor": student.id }, payload: { joinCode: classroom.joinCode } });
    assert.equal(join.statusCode, 201, join.body);
    const savedEnrollment = await db.classroomEnrollment.findUnique({ where: { classroomId_studentId: { classroomId: classroom.id, studentId: student.id } } });
    assert.equal(savedEnrollment?.status, "active");
    await assert.rejects(
      db.classroomEnrollment.create({ data: { classroomId: classroom.id, studentId: student.id, status: "active" } }),
      (error: { code?: string }) => error.code === "P2002",
      "the classroom/student uniqueness constraint must be enforced by PostgreSQL",
    );

    const roster = await app.inject({ method: "GET", url: `/api/teacher/classes/${classroom.id}/students`, headers: { "x-integration-actor": teacher.id } });
    assert.equal(roster.statusCode, 200, roster.body);
    assert.deepEqual(roster.json().students.map((row: { id: string }) => row.id), [student.id]);
    const otherTeacherRead = await app.inject({ method: "GET", url: `/api/teacher/classes/${classroom.id}/students`, headers: { "x-integration-actor": otherTeacher.id } });
    assert.equal(otherTeacherRead.statusCode, 404);

    const proposal = await app.inject({
      method: "POST", url: `/api/teacher/classes/${classroom.id}/interventions`, headers: { "x-integration-actor": teacher.id },
      payload: { studentId: student.id, topicId: topic.id, need: "Review fraction equivalence", action: "Complete guided practice" },
    });
    assert.equal(proposal.statusCode, 201, proposal.body);
    const interventionId = proposal.json<{ id: string }>().id;

    const approval = await app.inject({ method: "PATCH", url: `/api/teacher/interventions/${interventionId}`, headers: { "x-integration-actor": teacher.id }, payload: { status: "approved" } });
    assert.equal(approval.statusCode, 200, approval.body);
    const studentPlans = await app.inject({ method: "GET", url: "/api/student/interventions", headers: { "x-integration-actor": student.id } });
    assert.equal(studentPlans.statusCode, 200);
    assert.equal(studentPlans.json().interventions.length, 1);
    const outsiderPlans = await app.inject({ method: "GET", url: "/api/student/interventions", headers: { "x-integration-actor": outsider.id } });
    assert.equal(outsiderPlans.statusCode, 200);
    assert.equal(outsiderPlans.json().interventions.length, 0);
    const outsiderMutation = await app.inject({ method: "PATCH", url: `/api/student/interventions/${interventionId}`, headers: { "x-integration-actor": outsider.id }, payload: { status: "in_progress" } });
    assert.equal(outsiderMutation.statusCode, 404);

    const start = await app.inject({ method: "PATCH", url: `/api/student/interventions/${interventionId}`, headers: { "x-integration-actor": student.id }, payload: { status: "in_progress" } });
    assert.equal(start.statusCode, 200, start.body);
    const feedback = await app.inject({ method: "POST", url: `/api/teacher/interventions/${interventionId}/feedback`, headers: { "x-integration-actor": teacher.id }, payload: { feedback: "Show each conversion step." } });
    assert.equal(feedback.statusCode, 200, feedback.body);
    const completion = await app.inject({
      method: "PATCH", url: `/api/student/interventions/${interventionId}`, headers: { "x-integration-actor": student.id },
      payload: { status: "completed", outcomeNote: "Completed and checked the practice", followUpScore: 7, followUpMaxScore: 10 },
    });
    assert.equal(completion.statusCode, 200, completion.body);
    const savedIntervention = await db.intervention.findUnique({ where: { id: interventionId }, include: { events: { orderBy: { createdAt: "asc" } } } });
    assert.equal(savedIntervention?.status, "completed");
    assert.equal(savedIntervention?.baselineScore, 4);
    assert.equal(savedIntervention?.baselineMaxScore, 10);
    assert.equal(savedIntervention?.followUpScore, 7);
    assert.equal(savedIntervention?.followUpMaxScore, 10);
    assert.equal(savedIntervention?.teacherFeedback, "Show each conversion step.");
    assert.deepEqual(
      savedIntervention?.events.map((event) => `${event.fromStatus ?? "none"}>${event.toStatus}`).sort(),
      ["none>proposed", "proposed>approved", "approved>in_progress", "in_progress>in_progress", "in_progress>completed"].sort(),
    );
    const reassessment = await db.assessment.findFirst({ where: { userId: student.id, topicId: topic.id, title: `Intervention reassessment: ${topic.title}` } });
    assert.equal(reassessment?.score, 7);
    assert.equal(reassessment?.maxScore, 10);
    const baselinePercent = (savedIntervention!.baselineScore! / savedIntervention!.baselineMaxScore!) * 100;
    const reassessmentPercent = (reassessment!.score / reassessment!.maxScore) * 100;
    assert.equal(reassessmentPercent - baselinePercent, 30, "recorded score change is a descriptive percentage-point difference, not causal proof");

    const review = await app.inject({ method: "POST", url: `/api/teacher/interventions/${interventionId}/review`, headers: { "x-integration-actor": teacher.id }, payload: { feedback: "Continue spaced practice", followUpRequired: true } });
    assert.equal(review.statusCode, 200, review.body);
    const reviewed = await db.intervention.findUnique({ where: { id: interventionId } });
    assert.ok(reviewed?.reviewedAt);
    assert.equal(reviewed?.followUpRequired, true);

    const rollbackProposal = await db.intervention.create({ data: {
      classroomId: classroom.id, studentId: student.id, authorId: teacher.id, topicId: topic.id,
      need: "Rollback check", action: "Controlled test transaction", status: "in_progress",
      events: { create: { actorId: teacher.id, toStatus: "in_progress" } },
    } });
    const eventCountBefore = await db.interventionEvent.count({ where: { interventionId: rollbackProposal.id } });
    await assert.rejects(db.$transaction(async (tx) => {
      await tx.intervention.update({ where: { id: rollbackProposal.id }, data: {
        status: "completed", events: { create: { actorId: student.id, fromStatus: "in_progress", toStatus: "completed" } },
      } });
      await tx.assessment.create({ data: {
        userId: student.id, topicId: `missing-topic-${suffix}`, title: "Must roll back", subject: topic.subject,
        type: "quiz", score: 1, maxScore: 2, date: new Date(),
      } });
    }));
    const rolledBack = await db.intervention.findUnique({ where: { id: rollbackProposal.id } });
    assert.equal(rolledBack?.status, "in_progress");
    assert.equal(await db.interventionEvent.count({ where: { interventionId: rollbackProposal.id } }), eventCountBefore);
    assert.equal(await db.assessment.count({ where: { title: "Must roll back", userId: student.id } }), 0);
  } finally {
    if (app) await app.close();
    await db.user.deleteMany({ where: { clerkId: { in: clerkIds } } });
    await db.$disconnect();
  }
});
