import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import Fastify from "fastify";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { createTeacherRoutes } from "./teacher.js";
import type { prisma } from "../utils/prisma.js";

function setup(role: "teacher" | "student", actorId: string, db: Record<string, unknown>) {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    (request as AuthenticatedRequest).dbUser = { id: actorId, role, name: role, email: `${role}@example.test` };
  });
  void app.register(createTeacherRoutes(db as unknown as typeof prisma));
  return app;
}

afterEach(() => {});

test("class drill-down scopes lookup by the authenticated teacher and hides foreign classes", async () => {
  let lastWhere: unknown;
  const db = {
    classroom: { findFirst: async ({ where }: { where: unknown }) => { lastWhere = where; return null; } },
    classroomEnrollment: {},
    intervention: {},
  };
  const app = setup("teacher", "teacher-a", db);
  try {
    const response = await app.inject({ method: "GET", url: "/api/teacher/classes/class-1/students" });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(lastWhere, { id: "class-1", teacherId: "teacher-a" });
  } finally { await app.close(); }
});

test("teacher roster summarizes only active class members' observed topic states", async () => {
  const date = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
  let rosterQuery: Record<string, unknown> | undefined;
  const db = {
    classroom: { findFirst: async ({ where }: { where: unknown }) => where ? { id: "class-owned", subject: "Math" } : null },
    classroomEnrollment: { findMany: async (query: Record<string, unknown>) => {
      rosterQuery = query;
      const where = query.where;
      assert.deepEqual(where, { classroomId: "class-owned", status: "active" });
      return [
        { createdAt: date, student: { id: "s1", name: "Student 1", topics: [{ id: "t1", subject: "Math", title: "Fractions", status: "learning", updatedAt: date }], assessments: [{ id: "a1", topicId: "t1", score: 4, maxScore: 10, date }] } },
        { createdAt: date, student: { id: "s2", name: "Student 2", topics: [{ id: "t2", subject: "Math", title: "Fractions", status: "reviewing", updatedAt: date }], assessments: [{ id: "a2", topicId: "t2", score: 7, maxScore: 10, date }] } },
      ];
    } },
    intervention: {},
  };
  const app = setup("teacher", "teacher-a", db);
  try {
    const response = await app.inject({ method: "GET", url: "/api/teacher/classes/class-owned/students" });
    assert.equal(response.statusCode, 200);
    const result = response.json();
    assert.deepEqual(result.topicSummary, [{ subject: "Math", title: "Fractions", studentsWithTopic: 2, learning: 1, reviewing: 1, ready: 0, assessmentCount: 2, assessmentAveragePercent: 55, latestAssessmentAt: date.toISOString(), latestEvidenceAt: date.toISOString(), evidenceFreshness: "stale", observedSignal: "review_indicated" }]);
    assert.match(result.summaryNotice, /computed from saved topic and assessment records/i);
    assert.match(result.summaryNotice, /below 60%/i);
    const select = rosterQuery?.select as { student: { select: { topics: { where: unknown }; assessments: { where: unknown } } } };
    assert.deepEqual(select.student.select.topics.where, { subject: "Math" });
    assert.deepEqual(select.student.select.assessments.where, { subject: "Math" });
  } finally { await app.close(); }
});

test("teacher roster returns an explicit empty state for a class with no enrolled students", async () => {
  const db = {
    classroom: { findFirst: async () => ({ id: "empty-class", teacherId: "teacher-a", subject: "Science" }) },
    classroomEnrollment: { findMany: async () => [] },
    intervention: {},
  };
  const app = setup("teacher", "teacher-a", db);
  try {
    const response = await app.inject({ method: "GET", url: "/api/teacher/classes/empty-class/students" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().students, []);
    assert.deepEqual(response.json().topicSummary, []);
  } finally { await app.close(); }
});

test("student join code creates enrollment only for the authenticated student", async () => {
  let args: unknown;
  const db = {
    classroom: { findUnique: async () => ({ id: "class-1", joinCode: "shared-code-123", name: "Algebra", subject: "Math" }) },
    classroomEnrollment: { upsert: async (input: unknown) => { args = input; return {}; } },
    intervention: {},
  };
  const app = setup("student", "student-7", db);
  try {
    const response = await app.inject({ method: "POST", url: "/api/teacher/enrollments/accept", payload: { joinCode: "shared-code-123" } });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(args, {
      where: { classroomId_studentId: { classroomId: "class-1", studentId: "student-7" } },
      create: { classroomId: "class-1", studentId: "student-7", status: "active" },
      update: { status: "active" },
    });
  } finally { await app.close(); }
});

test("intervention route checks class ownership, enrollment, topic ownership, and ordered completion", async () => {
  const record: Record<string, unknown> = { id: "int-1", classroomId: "class-1", studentId: "student-7", authorId: "teacher-1", topicId: "topic-1", status: "proposed" };
  const calls: { classWhere?: unknown; ownedInterventionClassWhere?: unknown; enrollmentWhere?: unknown; topicWhere?: unknown; createData?: unknown; updateData?: unknown; reassessmentData?: unknown } = {};
  const db: Record<string, unknown> = {
    $transaction: async <T>(work: (tx: typeof db) => Promise<T>) => work(db),
    assessment: {
      findFirst: async () => ({ score: 4, maxScore: 10 }),
      create: async ({ data }: { data: unknown }) => { calls.reassessmentData = data; return data; },
    },
  };
  Object.assign(db, {
    classroom: { findFirst: async ({ where }: { where: Record<string, unknown> }) => { if (where.select) calls.classWhere = where; else calls.ownedInterventionClassWhere = where; return { id: "class-1" }; } },
    classroomEnrollment: { findUnique: async ({ where }: { where: unknown }) => { calls.enrollmentWhere = where; return { status: "active" }; } },
    topic: { findFirst: async ({ where }: { where: unknown }) => { calls.topicWhere = where; return { id: "topic-1", subject: "Math", title: "Fractions" }; } },
    intervention: {
      create: async ({ data }: { data: Record<string, unknown> }) => { calls.createData = data; Object.assign(record, data); return record; },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.studentId && where.studentId !== record.studentId) return null;
        const classroom = where.classroom as { teacherId?: string } | undefined;
        if (classroom?.teacherId && classroom.teacherId !== "teacher-1") return null;
        return record;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => { calls.updateData = data; Object.assign(record, data); return record; },
      findMany: async () => [record],
    },
  });
  const teacher = setup("teacher", "teacher-1", db);
  const student = setup("student", "student-7", db);
  const otherStudent = setup("student", "student-8", db);
  try {
    const proposal = await teacher.inject({ method: "POST", url: "/api/teacher/classes/class-1/interventions", payload: { studentId: "student-7", topicId: "topic-1", need: "Needs review of fractions", action: "Complete a short guided practice", evidenceSummary: "Teacher observed errors in recent work" } });
    assert.equal(proposal.statusCode, 201);
    assert.deepEqual(calls.ownedInterventionClassWhere, { id: "class-1", teacherId: "teacher-1" });
    assert.equal((calls.enrollmentWhere as { classroomId_studentId: { studentId: string } }).classroomId_studentId.studentId, "student-7");
    assert.deepEqual(calls.topicWhere, { id: "topic-1", userId: "student-7" });
    assert.equal((calls.createData as Record<string, unknown>).authorId, "teacher-1");
    assert.equal((calls.createData as Record<string, unknown>).baselineScore, 4);
    assert.equal((calls.createData as Record<string, unknown>).baselineMaxScore, 10);

    const approval = await teacher.inject({ method: "PATCH", url: "/api/teacher/interventions/int-1", payload: { status: "approved" } });
    assert.equal(approval.statusCode, 200);
    assert.equal(record.status, "approved");

    const foreignRead = await otherStudent.inject({ method: "PATCH", url: "/api/student/interventions/int-1", payload: { status: "in_progress" } });
    assert.equal(foreignRead.statusCode, 404);

    const start = await student.inject({ method: "PATCH", url: "/api/student/interventions/int-1", payload: { status: "in_progress" } });
    assert.equal(start.statusCode, 200);
    assert.equal(record.status, "in_progress");
    const feedback = await teacher.inject({ method: "POST", url: "/api/teacher/interventions/int-1/feedback", payload: { feedback: "Show each step in the next worked example." } });
    assert.equal(feedback.statusCode, 200);
    assert.equal((calls.updateData as Record<string, unknown>).teacherFeedback, "Show each step in the next worked example.");

    const noOutcome = await student.inject({ method: "PATCH", url: "/api/student/interventions/int-1", payload: { status: "completed" } });
    assert.equal(noOutcome.statusCode, 400);
    const missingReassessment = await student.inject({ method: "PATCH", url: "/api/student/interventions/int-1", payload: { status: "completed", outcomeNote: "Finished practice and checked the worked examples" } });
    assert.equal(missingReassessment.statusCode, 400);
    const complete = await student.inject({ method: "PATCH", url: "/api/student/interventions/int-1", payload: { status: "completed", outcomeNote: "Finished practice and checked the worked examples", followUpScore: 7, followUpMaxScore: 10 } });
    assert.equal(complete.statusCode, 200);
    assert.equal(record.status, "completed");
    assert.ok(calls.updateData && typeof calls.updateData === "object" && "completedAt" in calls.updateData);
    assert.equal((calls.updateData as Record<string, unknown>).followUpScore, 7);
    const { date: reassessmentDate, ...reassessment } = calls.reassessmentData as Record<string, unknown>;
    assert.ok(reassessmentDate instanceof Date);
    assert.deepEqual(reassessment, { userId: "student-7", title: "Intervention reassessment: Fractions", subject: "Math", topicId: "topic-1", type: "quiz", score: 7, maxScore: 10 });
    const review = await teacher.inject({ method: "POST", url: "/api/teacher/interventions/int-1/review", payload: { feedback: "Explain the ratio before calculating.", followUpRequired: true } });
    assert.equal(review.statusCode, 200);
    assert.equal(record.followUpRequired, true);
    assert.ok(record.reviewedAt instanceof Date);
    const duplicateReview = await teacher.inject({ method: "POST", url: "/api/teacher/interventions/int-1/review", payload: { feedback: "Updated review", followUpRequired: false } });
    assert.equal(duplicateReview.statusCode, 400);
  } finally {
    await Promise.all([teacher.close(), student.close(), otherStudent.close()]);
  }
});

test("teacher returns a stale-write conflict when an intervention changes concurrently", async () => {
  const db = {
    intervention: {
      findFirst: async () => ({ id: "int-stale", status: "proposed" }),
      update: async () => { throw Object.assign(new Error("Record no longer matches update filter"), { code: "P2025" }); },
    },
  };
  const app = setup("teacher", "teacher-1", db);
  try {
    const response = await app.inject({ method: "PATCH", url: "/api/teacher/interventions/int-stale", payload: { status: "approved" } });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, "stale_intervention");
  } finally { await app.close(); }
});

test("student receives a stale-write conflict when an intervention changes during its transaction", async () => {
  const db = {
    intervention: { findFirst: async () => ({ id: "int-stale", studentId: "student-1", status: "approved", topicId: "topic-1" }) },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
      intervention: { update: async () => { throw Object.assign(new Error("Record no longer matches update filter"), { code: "P2025" }); } },
    }),
  };
  const app = setup("student", "student-1", db);
  try {
    const response = await app.inject({ method: "PATCH", url: "/api/student/interventions/int-stale", payload: { status: "in_progress" } });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, "stale_intervention");
  } finally { await app.close(); }
});
