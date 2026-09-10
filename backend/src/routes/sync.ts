import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "../utils/prisma.js";
import { getDbUserId, type AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { isR2Configured, generateUploadUrl, generateDownloadUrl, buildR2Key, deleteObject, getR2PublicUrl } from "../services/r2.js";

// Sync status response
const syncStatusResponseZod = z.object({
  lastSyncedAt: z.string().datetime().nullable(),
  serverVersion: z.number(), // timestamp-based version
  hasLocalChanges: z.boolean().optional(),
});

const syncStatusResponseSchema = zodToJsonSchema(syncStatusResponseZod);

// Pull response (server -> client)
const pullTopicZod = z.object({
  id: z.string(),
  subject: z.string(),
  title: z.string(),
  examDate: z.string().datetime().nullable(),
  notes: z.string(),
  status: z.enum(["learning", "reviewing", "ready"]),
  checklist: z.object({
    understand: z.boolean(),
    practice: z.boolean(),
    revise: z.boolean(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const pullAttendanceSubjectZod = z.object({
  id: z.string(),
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

const pullResourceZod = z.object({
  id: z.string(),
  topicId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.string(),
  r2Key: z.string().nullable(),
  downloadUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const pullResponseZod = z.object({
  profile: z.object({ name: z.string().nullable() }).nullable(),
  topics: z.array(pullTopicZod),
  attendanceSubjects: z.array(pullAttendanceSubjectZod),
  resources: z.array(pullResourceZod),
  serverVersion: z.number(),
});

const pullResponseSchema = zodToJsonSchema(pullResponseZod);

// Push request (client -> server)
const pushTopicZod = z.object({
  id: z.string(),
  subject: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  examDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().default(""),
  status: z.enum(["learning", "reviewing", "ready"]).optional().default("learning"),
  checklist: z.object({
    understand: z.boolean(),
    practice: z.boolean(),
    revise: z.boolean(),
  }).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  _deleted: z.boolean().optional(),
});

const pushAttendanceSubjectZod = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  target: z.number().int().min(1).max(100).optional().default(75),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  records: z.array(z.object({
    id: z.string().optional(),
    record: z.enum(["present", "absent"]),
    createdAt: z.string().datetime().optional(),
  })).optional().default([]),
  _deleted: z.boolean().optional(),
});

const pushResourceZod = z.object({
  id: z.string(),
  topicId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().or(z.string()),
  r2Key: z.string().optional().nullable(),
  data: z.string().optional().nullable(), // base64 for non-R2 fallback
  addedAt: z.string().datetime().optional(),
  _deleted: z.boolean().optional(),
});

const pushRequestZod = z.object({
  profile: z.object({ name: z.string().min(1).max(40) }).nullable().optional(),
  topics: z.array(pushTopicZod).optional().default([]),
  attendanceSubjects: z.array(pushAttendanceSubjectZod).optional().default([]),
  resources: z.array(pushResourceZod).optional().default([]),
  clientVersion: z.number().optional(), // client's last known server version
});

const pushRequestSchema = zodToJsonSchema(pushRequestZod);

const pushResponseZod = z.object({
  success: z.boolean(),
  message: z.string(),
  serverVersion: z.number(),
  conflicts: z.array(z.object({
    type: z.enum(["topic", "attendanceSubject", "resource"]),
    id: z.string(),
    serverData: z.unknown(),
    clientData: z.unknown(),
  })).optional(),
  stats: z.object({
    topicsCreated: z.number(),
    topicsUpdated: z.number(),
    topicsDeleted: z.number(),
    attendanceCreated: z.number(),
    attendanceUpdated: z.number(),
    attendanceDeleted: z.number(),
    resourcesCreated: z.number(),
    resourcesUpdated: z.number(),
    resourcesDeleted: z.number(),
  }).optional(),
});

const pushResponseSchema = zodToJsonSchema(pushResponseZod);

// R2 upload URL response
const r2UploadUrlResponseZod = z.object({
  uploadUrl: z.string(),
  key: z.string(),
  publicUrl: z.string().nullable(),
});

const r2UploadUrlResponseSchema = zodToJsonSchema(r2UploadUrlResponseZod);

const r2DownloadUrlResponseZod = z.object({
  downloadUrl: z.string(),
});

const r2DownloadUrlResponseSchema = zodToJsonSchema(r2DownloadUrlResponseZod);

const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/sync/status - Get sync status
  app.get("/api/sync/status", {
    schema: {
      tags: ["Sync"],
      summary: "Get sync status for the current user",
      response: {
        200: syncStatusResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastSyncedAt: true, updatedAt: true } });

    return {
      lastSyncedAt: user?.lastSyncedAt?.toISOString() ?? null,
      serverVersion: user?.updatedAt.getTime() ?? Date.now(),
    };
  });

  // POST /api/sync/pull - Pull all data from server
  app.post("/api/sync/pull", {
    schema: {
      tags: ["Sync"],
      summary: "Pull all user data from server (server -> client)",
      response: {
        200: pullResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const [user, topics, attendanceSubjects, resources] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, updatedAt: true } }),
      prisma.topic.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
      prisma.attendanceSubject.findMany({
        where: { userId },
        include: { records: { orderBy: { createdAt: "asc" } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.resource.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    ]);

    // Generate R2 download URLs if configured
    const resourcesWithUrls = await Promise.all(resources.map(async (r) => {
      let downloadUrl: string | null = null;
      if (r.r2Key && isR2Configured()) {
        downloadUrl = await generateDownloadUrl(r.r2Key);
      }
      return {
        id: r.id,
        topicId: r.topicId,
        name: r.name,
        mimeType: r.mimeType,
        size: r.size.toString(),
        r2Key: r.r2Key,
        downloadUrl,
        createdAt: r.createdAt.toISOString(),
      };
    }));

    const serverVersion = Math.max(
      user?.updatedAt.getTime() ?? 0,
      ...topics.map(t => t.updatedAt.getTime()),
      ...attendanceSubjects.map(a => a.updatedAt.getTime()),
      ...resources.map(r => r.createdAt.getTime())
    );

    return {
      profile: user ? { name: user.name } : null,
      topics: topics.map(t => ({
        id: t.id,
        subject: t.subject,
        title: t.title,
        examDate: t.examDate?.toISOString() ?? null,
        notes: t.notes,
        status: t.status,
        checklist: t.checklist as { understand: boolean; practice: boolean; revise: boolean },
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      attendanceSubjects: attendanceSubjects.map(a => ({
        id: a.id,
        name: a.name,
        target: a.target,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        records: a.records.map(r => ({
          id: r.id,
          record: r.record,
          createdAt: r.createdAt.toISOString(),
        })),
      })),
      resources: resourcesWithUrls,
      serverVersion,
    };
  });

  // POST /api/sync/push - Push local changes to server with conflict resolution
  app.post("/api/sync/push", {
    schema: {
      tags: ["Sync"],
      summary: "Push local changes to server (client -> server) with conflict resolution",
      body: pushRequestSchema,
      response: {
        200: pushResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    const pushData = request.body as z.infer<typeof pushRequestZod>;
    const clientVersion = pushData.clientVersion ?? 0;

    // Get current server state for conflict detection
    const [serverTopics, serverAttendance, serverResources] = await Promise.all([
      prisma.topic.findMany({ where: { userId } }),
      prisma.attendanceSubject.findMany({ where: { userId }, include: { records: true } }),
      prisma.resource.findMany({ where: { userId } }),
    ]);

    const serverTopicMap = new Map(serverTopics.map(t => [t.id, t]));
    const serverAttendanceMap = new Map(serverAttendance.map(a => [a.id, a]));
    const serverResourceMap = new Map(serverResources.map(r => [r.id, r]));

    const conflicts: Array<{ type: string; id: string; serverData: unknown; clientData: unknown }> = [];
    const stats = {
      topicsCreated: 0, topicsUpdated: 0, topicsDeleted: 0,
      attendanceCreated: 0, attendanceUpdated: 0, attendanceDeleted: 0,
      resourcesCreated: 0, resourcesUpdated: 0, resourcesDeleted: 0,
    };

    try {
      await prisma.$transaction(async (tx) => {
        // --- Profile update ---
        if (pushData.profile?.name) {
          await tx.user.update({ where: { id: userId }, data: { name: pushData.profile.name } });
        }

        // --- Topics ---
        for (const clientTopic of pushData.topics) {
          const serverTopic = serverTopicMap.get(clientTopic.id);

          if (clientTopic._deleted) {
            if (serverTopic) {
              // Delete topic and its resources
              await tx.resource.deleteMany({ where: { topicId: clientTopic.id } });
              await tx.topic.delete({ where: { id: clientTopic.id } });
              stats.topicsDeleted++;
            }
            continue;
          }

          const clientUpdatedAt = clientTopic.updatedAt ? new Date(clientTopic.updatedAt).getTime() : 0;
          const serverUpdatedAt = serverTopic?.updatedAt.getTime() ?? 0;

          if (serverTopic && serverUpdatedAt > clientUpdatedAt && serverUpdatedAt > clientVersion) {
            // Server has newer version - conflict
            conflicts.push({
              type: "topic",
              id: clientTopic.id,
              serverData: {
                subject: serverTopic.subject,
                title: serverTopic.title,
                examDate: serverTopic.examDate?.toISOString() ?? null,
                notes: serverTopic.notes,
                status: serverTopic.status,
                checklist: serverTopic.checklist,
                updatedAt: serverTopic.updatedAt.toISOString(),
              },
              clientData: clientTopic,
            });
            continue; // Skip - let client resolve
          }

          if (serverTopic) {
            // Update existing
            await tx.topic.update({
              where: { id: clientTopic.id },
              data: {
                userId,
                subject: clientTopic.subject,
                title: clientTopic.title,
                examDate: clientTopic.examDate ? new Date(clientTopic.examDate) : null,
                notes: clientTopic.notes ?? "",
                status: clientTopic.status ?? "learning",
                checklist: clientTopic.checklist ?? { understand: false, practice: false, revise: false },
                updatedAt: new Date(),
              },
            });
            stats.topicsUpdated++;
          } else {
            // Create new
            await tx.topic.create({
              data: {
                id: clientTopic.id,
                userId,
                subject: clientTopic.subject,
                title: clientTopic.title,
                examDate: clientTopic.examDate ? new Date(clientTopic.examDate) : null,
                notes: clientTopic.notes ?? "",
                status: clientTopic.status ?? "learning",
                checklist: clientTopic.checklist ?? { understand: false, practice: false, revise: false },
                createdAt: clientTopic.createdAt ? new Date(clientTopic.createdAt) : new Date(),
                updatedAt: new Date(),
              },
            });
            stats.topicsCreated++;
          }
        }

        // --- Attendance Subjects ---
        for (const clientSubject of pushData.attendanceSubjects) {
          const serverSubject = serverAttendanceMap.get(clientSubject.id);

          if (clientSubject._deleted) {
            if (serverSubject) {
              await tx.attendanceSubject.delete({ where: { id: clientSubject.id } });
              stats.attendanceDeleted++;
            }
            continue;
          }

          const clientUpdatedAt = clientSubject.updatedAt ? new Date(clientSubject.updatedAt).getTime() : 0;
          const serverUpdatedAt = serverSubject?.updatedAt.getTime() ?? 0;

          if (serverSubject && serverUpdatedAt > clientUpdatedAt && serverUpdatedAt > clientVersion) {
            conflicts.push({
              type: "attendanceSubject",
              id: clientSubject.id,
              serverData: {
                name: serverSubject.name,
                target: serverSubject.target,
                records: serverSubject.records.map(r => ({ id: r.id, record: r.record, createdAt: r.createdAt.toISOString() })),
                updatedAt: serverSubject.updatedAt.toISOString(),
              },
              clientData: clientSubject,
            });
            continue;
          }

          if (serverSubject) {
            // Update subject
            await tx.attendanceSubject.update({
              where: { id: clientSubject.id },
              data: {
                userId,
                name: clientSubject.name,
                target: clientSubject.target ?? 75,
                updatedAt: new Date(),
              },
            });

            // Sync records - upsert by id or create new
            const serverRecordMap = new Map(serverSubject.records.map(r => [r.id, r]));
            for (const clientRecord of clientSubject.records ?? []) {
              if (clientRecord.id && serverRecordMap.has(clientRecord.id)) {
                // Update existing record (rare for attendance)
                // Attendance records are typically immutable, but we allow it
              } else {
                // Create new record
                await tx.attendanceRecord.create({
                  data: {
                    attendanceSubjectId: clientSubject.id,
                    record: clientRecord.record,
                    createdAt: clientRecord.createdAt ? new Date(clientRecord.createdAt) : new Date(),
                  },
                });
              }
            }
            stats.attendanceUpdated++;
          } else {
            // Create new subject with records
            await tx.attendanceSubject.create({
              data: {
                id: clientSubject.id,
                userId,
                name: clientSubject.name,
                target: clientSubject.target ?? 75,
                createdAt: clientSubject.createdAt ? new Date(clientSubject.createdAt) : new Date(),
                updatedAt: new Date(),
                records: {
                  create: (clientSubject.records ?? []).map(r => ({
                    record: r.record,
                    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                  })),
                },
              },
            });
            stats.attendanceCreated++;
          }
        }

        // --- Resources ---
        for (const clientResource of pushData.resources) {
          const serverResource = serverResourceMap.get(clientResource.id);

          if (clientResource._deleted) {
            if (serverResource) {
              if (serverResource.r2Key && isR2Configured()) {
                await deleteObject(serverResource.r2Key);
              }
              await tx.resource.delete({ where: { id: clientResource.id } });
              stats.resourcesDeleted++;
            }
            continue;
          }

          const clientUpdatedAt = clientResource.addedAt ? new Date(clientResource.addedAt).getTime() : 0;
          const serverUpdatedAt = serverResource?.createdAt.getTime() ?? 0;

          if (serverResource && serverUpdatedAt > clientUpdatedAt && serverUpdatedAt > clientVersion) {
            conflicts.push({
              type: "resource",
              id: clientResource.id,
              serverData: {
                name: serverResource.name,
                mimeType: serverResource.mimeType,
                size: serverResource.size.toString(),
                r2Key: serverResource.r2Key,
                createdAt: serverResource.createdAt.toISOString(),
              },
              clientData: clientResource,
            });
            continue;
          }

          // Verify topic exists
          const topic = await tx.topic.findFirst({ where: { id: clientResource.topicId, userId } });
          if (!topic) continue;

          const sizeBytes = Number(clientResource.size);
          if (sizeBytes > 20 * 1024 * 1024) continue;

          const r2Key = clientResource.r2Key || (isR2Configured() ? buildR2Key(userId, clientResource.id, clientResource.name) : null);

          if (serverResource) {
            await tx.resource.update({
              where: { id: clientResource.id },
              data: {
                userId,
                topicId: clientResource.topicId,
                name: clientResource.name,
                mimeType: clientResource.mimeType,
                size: BigInt(sizeBytes),
                data: clientResource.data ?? null,
                r2Key,
              },
            });
            stats.resourcesUpdated++;
          } else {
            await tx.resource.create({
              data: {
                id: clientResource.id,
                userId,
                topicId: clientResource.topicId,
                name: clientResource.name,
                mimeType: clientResource.mimeType,
                size: BigInt(sizeBytes),
                data: clientResource.data ?? null,
                r2Key,
                createdAt: clientResource.addedAt ? new Date(clientResource.addedAt) : new Date(),
              },
            });
            stats.resourcesCreated++;
          }
        }

        // Update user's lastSyncedAt
        await tx.user.update({
          where: { id: userId },
          data: { lastSyncedAt: new Date() },
        });
      });

      const newServerVersion = Date.now();

      if (conflicts.length > 0) {
        return {
          success: false,
          message: "Conflicts detected. Please resolve.",
          serverVersion: newServerVersion,
          conflicts,
          stats,
        };
      }

      return {
        success: true,
        message: "Sync completed successfully",
        serverVersion: newServerVersion,
        stats,
      };
    } catch (error) {
      console.error("Push sync failed:", error);
      return reply.status(500).send({
        error: "sync_failed",
        message: "Failed to push changes. Database error occurred.",
      });
    }
  });

  // GET /api/sync/r2/upload-url - Get presigned upload URL for R2
  app.get("/api/sync/r2/upload-url", {
    schema: {
      tags: ["Sync", "R2"],
      summary: "Get presigned URL for uploading a file to R2",
      querystring: z.object({
        resourceId: z.string(),
        fileName: z.string(),
        contentType: z.string(),
      }),
      response: {
        200: r2UploadUrlResponseSchema,
        401: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    if (!isR2Configured()) {
      return reply.status(503).send({ error: "service_unavailable", message: "R2 storage not configured" });
    }

    const { resourceId, fileName, contentType } = request.query as { resourceId: string; fileName: string; contentType: string };
    const key = buildR2Key(userId, resourceId, fileName);
    const uploadUrl = await generateUploadUrl(key, contentType);
    const publicUrl = getR2PublicUrl() ? `${getR2PublicUrl()}/${key}` : null;

    if (!uploadUrl) {
      return reply.status(500).send({ error: "upload_failed", message: "Failed to generate upload URL" });
    }

    return { uploadUrl, key, publicUrl };
  });

  // GET /api/sync/r2/download-url - Get presigned download URL for R2
  app.get("/api/sync/r2/download-url", {
    schema: {
      tags: ["Sync", "R2"],
      summary: "Get presigned URL for downloading a file from R2",
      querystring: z.object({ key: z.string() }),
      response: {
        200: r2DownloadUrlResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request: AuthenticatedRequest, reply) => {
    const userId = getDbUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Authentication required" });

    if (!isR2Configured()) {
      return reply.status(503).send({ error: "service_unavailable", message: "R2 storage not configured" });
    }

    const { key } = request.query as { key: string };

    // Verify the resource belongs to the user
    const resource = await prisma.resource.findFirst({ where: { r2Key: key, userId } });
    if (!resource) {
      return reply.status(404).send({ error: "not_found", message: "Resource not found" });
    }

    const downloadUrl = await generateDownloadUrl(key);
    if (!downloadUrl) {
      return reply.status(500).send({ error: "download_failed", message: "Failed to generate download URL" });
    }

    return { downloadUrl };
  });
}