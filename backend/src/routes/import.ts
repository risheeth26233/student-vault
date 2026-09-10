import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "../utils/prisma.js";
import { getDbUserId, type AuthenticatedRequest } from "../plugins/clerk-auth.js";

// Backup v1 schema (matches frontend export format)
const backupChecklistZod = z.object({
  understand: z.boolean(),
  practice: z.boolean(),
  revise: z.boolean(),
});

const backupTopicZod = z.object({
  id: z.string(),
  subject: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  examDate: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
  status: z.enum(["learning", "reviewing", "ready"]).optional().default("learning"),
  checklist: backupChecklistZod.optional(),
  createdAt: z.string().datetime().optional(),
});

const backupAttendanceSubjectZod = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  target: z.number().int().min(1).max(100).optional().default(75),
  records: z.array(z.enum(["present", "absent"])).optional().default([]),
});

const backupResourceZod = z.object({
  id: z.string(),
  topicId: z.string(),
  name: z.string(),
  type: z.string(), // MIME type
  size: z.number().or(z.string()),
  data: z.string(), // Base64 data URL
  addedAt: z.string().datetime().optional(),
});

const backupProfileZod = z.object({
  name: z.string().min(1).max(40),
}).nullable();

const backupV1Zod = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  profile: backupProfileZod,
  topics: z.array(backupTopicZod),
  attendanceSubjects: z.array(backupAttendanceSubjectZod),
  resources: z.array(backupResourceZod),
});

const importResponseZod = z.object({
  success: z.boolean(),
  message: z.string(),
  stats: z.object({
    topicsImported: z.number(),
    attendanceSubjectsImported: z.number(),
    resourcesImported: z.number(),
  }).optional(),
});

const importResponseSchema = zodToJsonSchema(importResponseZod);
const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

export async function importRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/import/v1 - Import Student Vault backup v1
  app.post("/api/import/v1", {
    schema: {
      tags: ["Import"],
      summary: "Import Student Vault backup v1",
      body: backupV1Zod,
      response: {
        200: importResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const backup = request.body as z.infer<typeof backupV1Zod>;

    // Validate backup version
    if (backup.version !== 1) {
      return reply.status(400).send({ error: "invalid_version", message: `Unsupported backup version ${backup.version}. Only version 1 is supported.` });
    }

    // Validate all required arrays exist
    if (!Array.isArray(backup.topics)) {
      return reply.status(400).send({ error: "invalid_format", message: "Backup missing topics array" });
    }
    if (!Array.isArray(backup.attendanceSubjects)) {
      return reply.status(400).send({ error: "invalid_format", message: "Backup missing attendanceSubjects array" });
    }
    if (!Array.isArray(backup.resources)) {
      return reply.status(400).send({ error: "invalid_format", message: "Backup missing resources array" });
    }

    // Validate each topic has required fields
    for (const topic of backup.topics) {
      if (!topic.id || !topic.subject || !topic.title) {
        return reply.status(400).send({ error: "invalid_topic", message: "Invalid topic data in backup: missing id, subject, or title" });
      }
    }

    // Validate each attendance subject
    for (const subject of backup.attendanceSubjects) {
      if (!subject.id || !subject.name || !Array.isArray(subject.records)) {
        return reply.status(400).send({ error: "invalid_attendance", message: "Invalid attendance subject data in backup" });
      }
    }

    // Validate each resource
    for (const resource of backup.resources) {
      if (!resource.id || !resource.topicId || !resource.name || !resource.data) {
        return reply.status(400).send({ error: "invalid_resource", message: "Invalid resource data in backup" });
      }
    }

    // Perform import in a transaction
    try {
      const stats = await prisma.$transaction(async (tx) => {
        let topicsImported = 0;
        let attendanceSubjectsImported = 0;
        let resourcesImported = 0;

        // Import profile (update user name)
        if (backup.profile && backup.profile.name) {
          await tx.user.update({
            where: { id: userId },
            data: { name: backup.profile.name },
          });
        }

        // Import topics
        for (const topic of backup.topics) {
          await tx.topic.upsert({
            where: { id: topic.id },
            create: {
              id: topic.id,
              userId,
              subject: topic.subject,
              title: topic.title,
              examDate: topic.examDate ? new Date(topic.examDate) : null,
              notes: topic.notes ?? "",
              status: topic.status ?? "learning",
              checklist: topic.checklist ?? { understand: false, practice: false, revise: false },
              createdAt: topic.createdAt ? new Date(topic.createdAt) : new Date(),
              updatedAt: new Date(),
            },
            update: {
              userId,
              subject: topic.subject,
              title: topic.title,
              examDate: topic.examDate ? new Date(topic.examDate) : null,
              notes: topic.notes ?? "",
              status: topic.status ?? "learning",
              checklist: topic.checklist ?? { understand: false, practice: false, revise: false },
              updatedAt: new Date(),
            },
          });
          topicsImported++;
        }

        // Import attendance subjects
        for (const subject of backup.attendanceSubjects) {
          const validTarget = subject.target && Number.isInteger(subject.target) && subject.target >= 1 && subject.target <= 100
            ? subject.target : 75;

          await tx.attendanceSubject.upsert({
            where: { id: subject.id },
            create: {
              id: subject.id,
              userId,
              name: subject.name,
              target: validTarget,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            update: {
              userId,
              name: subject.name,
              target: validTarget,
              updatedAt: new Date(),
            },
          });

          // Import attendance records
          const records = (subject.records ?? []).filter((r): r is "present" | "absent" => r === "present" || r === "absent");
          for (const record of records) {
            await tx.attendanceRecord.create({
              data: {
                attendanceSubjectId: subject.id,
                record,
              },
            });
          }
          attendanceSubjectsImported++;
        }

        // Import resources
        for (const resource of backup.resources) {
          // Verify topic exists (it should if topics were imported first)
          const topicExists = await tx.topic.findUnique({ where: { id: resource.topicId } });
          if (!topicExists) {
            // Skip resources for non-existent topics
            continue;
          }

          const sizeBytes = Number(resource.size);
          if (sizeBytes > 20 * 1024 * 1024) {
            // Skip oversized resources
            continue;
          }

          await tx.resource.upsert({
            where: { id: resource.id },
            create: {
              id: resource.id,
              userId,
              topicId: resource.topicId,
              name: resource.name,
              mimeType: resource.type,
              size: BigInt(sizeBytes),
              data: resource.data,
              createdAt: resource.addedAt ? new Date(resource.addedAt) : new Date(),
            },
            update: {
              userId,
              topicId: resource.topicId,
              name: resource.name,
              mimeType: resource.type,
              size: BigInt(sizeBytes),
              data: resource.data,
            },
          });
          resourcesImported++;
        }

        return { topicsImported, attendanceSubjectsImported, resourcesImported };
      });

      return {
        success: true,
        message: `Backup imported successfully from ${new Date(backup.exportedAt).toLocaleString()}`,
        stats,
      };
    } catch (error) {
      console.error("Import failed:", error);
      return reply.status(500).send({
        error: "import_failed",
        message: "Failed to import backup. Database error occurred.",
      });
    }
  });
}