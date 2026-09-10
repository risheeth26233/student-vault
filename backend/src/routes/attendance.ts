import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "../utils/prisma.js";
import { getDbUserId, type AuthenticatedRequest } from "../plugins/clerk-auth.js";

const attendanceSubjectCreateZod = z.object({
  name: z.string().min(1).max(40),
  target: z.number().int().min(1).max(100).optional().default(75),
});

const attendanceSubjectUpdateZod = z.object({
  name: z.string().min(1).max(40).optional(),
  target: z.number().int().min(1).max(100).optional(),
});

const attendanceRecordCreateZod = z.object({
  record: z.enum(["present", "absent"]),
});

const attendanceSubjectResponseZod = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  target: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  records: z.array(z.object({
    id: z.string(),
    record: z.enum(["present", "absent"]),
    createdAt: z.string().datetime(),
  })),
});

const attendanceSubjectsListResponseZod = z.object({
  subjects: z.array(attendanceSubjectResponseZod),
  total: z.number(),
});

const attendanceStatsZod = z.object({
  totalPresent: z.number(),
  totalAbsent: z.number(),
  totalClasses: z.number(),
  overallPercentage: z.string(),
  subjectsTracked: z.number(),
});

const errorResponseZod = z.object({ error: z.string(), message: z.string() });

const attendanceSubjectCreateSchema = zodToJsonSchema(attendanceSubjectCreateZod);
const attendanceSubjectUpdateSchema = zodToJsonSchema(attendanceSubjectUpdateZod);
const attendanceRecordCreateSchema = zodToJsonSchema(attendanceRecordCreateZod);
const attendanceSubjectResponseSchema = zodToJsonSchema(attendanceSubjectResponseZod);
const attendanceSubjectsListResponseSchema = zodToJsonSchema(attendanceSubjectsListResponseZod);
const attendanceStatsSchema = zodToJsonSchema(attendanceStatsZod);
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/attendance - List all attendance subjects with stats
  app.get("/api/attendance", {
    schema: {
      tags: ["Attendance"],
      summary: "List all attendance subjects with their records",
      response: {
        200: attendanceSubjectsListResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const subjects = await prisma.attendanceSubject.findMany({
      where: { userId },
      include: {
        records: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      subjects: subjects.map(formatAttendanceSubject),
      total: subjects.length,
    };
  });

  // GET /api/attendance/stats - Get overall attendance statistics
  app.get("/api/attendance/stats", {
    schema: {
      tags: ["Attendance"],
      summary: "Get overall attendance statistics",
      response: {
        200: attendanceStatsSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const subjects = await prisma.attendanceSubject.findMany({
      where: { userId },
      include: { records: true },
    });

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalClasses = 0;

    for (const subject of subjects) {
      for (const record of subject.records) {
        if (record.record === "present") totalPresent++;
        else totalAbsent++;
        totalClasses++;
      }
    }

    const overallPercentage = totalClasses === 0 ? "--" : `${((totalPresent * 100) / totalClasses).toFixed(1)}%`;

    return {
      totalPresent,
      totalAbsent,
      totalClasses,
      overallPercentage,
      subjectsTracked: subjects.length,
    };
  });

  // POST /api/attendance - Create a new attendance subject
  app.post("/api/attendance", {
    schema: {
      tags: ["Attendance"],
      summary: "Create a new attendance subject",
      body: attendanceSubjectCreateSchema,
      response: {
        201: attendanceSubjectResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const data = request.body as z.infer<typeof attendanceSubjectCreateZod>;

    // Check for duplicate name (case-insensitive)
    const existing = await prisma.attendanceSubject.findFirst({
      where: { userId, name: { equals: data.name, mode: "insensitive" } },
    });
    if (existing) {
      return reply.status(400).send({ error: "duplicate", message: "A subject with this name already exists" });
    }

    const subject = await prisma.attendanceSubject.create({
      data: {
        userId,
        name: data.name,
        target: data.target ?? 75,
      },
      include: { records: true },
    });

    return reply.status(201).send(formatAttendanceSubject(subject));
  });

  // GET /api/attendance/:id - Get a single attendance subject
  app.get("/api/attendance/:id", {
    schema: {
      tags: ["Attendance"],
      summary: "Get an attendance subject by ID",
      params: z.object({ id: z.string() }),
      response: {
        200: attendanceSubjectResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const subject = await prisma.attendanceSubject.findFirst({
      where: { id, userId },
      include: { records: { orderBy: { createdAt: "asc" } } },
    });

    if (!subject) {
      return reply.status(404).send({ error: "not_found", message: "Attendance subject not found" });
    }

    return formatAttendanceSubject(subject);
  });

  // PUT /api/attendance/:id - Update an attendance subject
  app.put("/api/attendance/:id", {
    schema: {
      tags: ["Attendance"],
      summary: "Update an attendance subject",
      params: z.object({ id: z.string() }),
      body: attendanceSubjectUpdateSchema,
      response: {
        200: attendanceSubjectResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const data = request.body as z.infer<typeof attendanceSubjectUpdateZod>;

    const existing = await prisma.attendanceSubject.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Attendance subject not found" });
    }

    // Check for duplicate name if name is being updated
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.attendanceSubject.findFirst({
        where: { userId, name: { equals: data.name, mode: "insensitive" }, id: { not: id } },
      });
      if (duplicate) {
        return reply.status(400).send({ error: "duplicate", message: "A subject with this name already exists" });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.target !== undefined) updateData.target = data.target;

    const subject = await prisma.attendanceSubject.update({
      where: { id },
      data: updateData,
      include: { records: { orderBy: { createdAt: "asc" } } },
    });

    return formatAttendanceSubject(subject);
  });

  // POST /api/attendance/:id/records - Add an attendance record (present/absent)
  app.post("/api/attendance/:id/records", {
    schema: {
      tags: ["Attendance"],
      summary: "Mark a class as present or absent",
      params: z.object({ id: z.string() }),
      body: attendanceRecordCreateSchema,
      response: {
        201: attendanceSubjectResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const { record } = request.body as z.infer<typeof attendanceRecordCreateZod>;

    const subject = await prisma.attendanceSubject.findFirst({ where: { id, userId } });
    if (!subject) {
      return reply.status(404).send({ error: "not_found", message: "Attendance subject not found" });
    }

    await prisma.attendanceRecord.create({
      data: {
        attendanceSubjectId: id,
        record,
      },
    });

    const updated = await prisma.attendanceSubject.findFirst({
      where: { id, userId },
      include: { records: { orderBy: { createdAt: "asc" } } },
    });

    return reply.status(201).send(formatAttendanceSubject(updated!));
  });

  // DELETE /api/attendance/:id/records/undo - Undo the last attendance record
  app.delete("/api/attendance/:id/records/undo", {
    schema: {
      tags: ["Attendance"],
      summary: "Remove the last attendance record",
      params: z.object({ id: z.string() }),
      response: {
        200: attendanceSubjectResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };

    const subject = await prisma.attendanceSubject.findFirst({ where: { id, userId } });
    if (!subject) {
      return reply.status(404).send({ error: "not_found", message: "Attendance subject not found" });
    }

    const lastRecord = await prisma.attendanceRecord.findFirst({
      where: { attendanceSubjectId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!lastRecord) {
      return reply.status(400).send({ error: "no_records", message: "No records to undo" });
    }

    await prisma.attendanceRecord.delete({ where: { id: lastRecord.id } });

    const updated = await prisma.attendanceSubject.findFirst({
      where: { id, userId },
      include: { records: { orderBy: { createdAt: "asc" } } },
    });

    return formatAttendanceSubject(updated!);
  });

  // PUT /api/attendance/:id/target - Update attendance goal target
  app.put("/api/attendance/:id/target", {
    schema: {
      tags: ["Attendance"],
      summary: "Update attendance goal target",
      params: z.object({ id: z.string() }),
      body: z.object({ target: z.number().int().min(1).max(100) }),
      response: {
        200: attendanceSubjectResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const { id } = request.params as { id: string };
    const { target } = request.body as { target: number };

    const subject = await prisma.attendanceSubject.findFirst({ where: { id, userId } });
    if (!subject) {
      return reply.status(404).send({ error: "not_found", message: "Attendance subject not found" });
    }

    const updated = await prisma.attendanceSubject.update({
      where: { id },
      data: { target },
      include: { records: { orderBy: { createdAt: "asc" } } },
    });

    return formatAttendanceSubject(updated);
  });

  // DELETE /api/attendance/:id - Delete an attendance subject and all its records
  app.delete("/api/attendance/:id", {
    schema: {
      tags: ["Attendance"],
      summary: "Delete an attendance subject and all its records",
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
    const existing = await prisma.attendanceSubject.findFirst({ where: { id, userId } });
    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Attendance subject not found" });
    }

    await prisma.attendanceSubject.delete({ where: { id } });

    return { success: true as const };
  });
}

function formatAttendanceSubject(subject: {
  id: string;
  userId: string;
  name: string;
  target: number;
  createdAt: Date;
  updatedAt: Date;
  records: Array<{ id: string; record: "present" | "absent"; createdAt: Date }>;
}) {
  return {
    id: subject.id,
    userId: subject.userId,
    name: subject.name,
    target: subject.target,
    createdAt: subject.createdAt.toISOString(),
    updatedAt: subject.updatedAt.toISOString(),
    records: subject.records.map((r) => ({
      id: r.id,
      record: r.record,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}