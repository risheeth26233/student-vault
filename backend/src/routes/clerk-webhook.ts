import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { getEnv } from "../config/env.js";
import { toJsonSchema } from "../utils/schema.js";
import { verifyClerkWebhookSignature } from "../utils/clerkWebhookSignature.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

const env = getEnv();

const clerkWebhookEventZod = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    email_addresses: z.array(z.object({
      email_address: z.string().email(),
    })).optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    image_url: z.string().url().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  }),
});

const clerkWebhookEventSchema = toJsonSchema(clerkWebhookEventZod);

const webhookResponseZod = z.object({ received: z.literal(true) });
const webhookResponseSchema = toJsonSchema(webhookResponseZod);

const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = toJsonSchema(errorResponseZod);

export function createClerkWebhookRoutes(db = prisma, secret = env.CLERK_WEBHOOK_SECRET) {
return async function clerkWebhookRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/webhooks/clerk - Handle Clerk webhook events
  app.post("/api/webhooks/clerk", {
    schema: {
      tags: ["Webhooks"],
      summary: "Handle Clerk webhook events",
      body: clerkWebhookEventSchema,
      response: {
        200: webhookResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const webhookSecret = secret;
    if (!webhookSecret) return reply.status(503).send({ error: "service_unavailable", message: "Webhook verification is not configured" });
    const header = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
    const signatureValid = verifyClerkWebhookSignature({
      secret: webhookSecret,
      id: header(request.headers["svix-id"]),
      timestamp: header(request.headers["svix-timestamp"]),
      signature: header(request.headers["svix-signature"]),
      rawBody: request.rawBody,
    });
    if (!signatureValid) return reply.status(401).send({ error: "unauthorized", message: "Invalid webhook signature" });

    const event = request.body as z.infer<typeof clerkWebhookEventZod>;

    try {
      switch (event.type) {
        case "user.created":
        case "user.updated": {
          const userData = event.data;
          const email = userData.email_addresses?.[0]?.email_address;
          
          if (!email) {
            return reply.status(400).send({ error: "invalid_data", message: "User email not found" });
          }

          await db.user.upsert({
            where: { clerkId: userData.id },
            create: {
              clerkId: userData.id,
              email,
              name: userData.first_name || userData.username || "User",
            },
            update: {
              email,
              name: userData.first_name || userData.username || "User",
            },
          });
          break;
        }
        case "user.deleted": {
          const userData = event.data;
          await db.user.deleteMany({
            where: { clerkId: userData.id },
          });
          break;
        }
        default:
          // Ignore other event types
          break;
      }

      return { received: true as const };
    } catch {
      app.log.error({ eventType: event.type }, "Clerk webhook handler failed");
      return reply.status(500).send({
        error: "webhook_failed",
        message: "Failed to process webhook event",
      });
    }
  });
};
}

export const clerkWebhookRoutes = createClerkWebhookRoutes();
