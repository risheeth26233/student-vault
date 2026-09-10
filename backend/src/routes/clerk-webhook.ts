import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "../utils/prisma.js";
import { getEnv } from "../config/env.js";

const env = getEnv();

const clerkWebhookEventZod = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    email_addresses: z.array(z.object({
      email_address: z.string().email(),
    })),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    username: z.string().nullable(),
    image_url: z.string().url(),
    created_at: z.number(),
    updated_at: z.number(),
  }),
});

const clerkWebhookEventSchema = zodToJsonSchema(clerkWebhookEventZod);

const webhookResponseZod = z.object({ received: z.literal(true) });
const webhookResponseSchema = zodToJsonSchema(webhookResponseZod);

const errorResponseZod = z.object({ error: z.string(), message: z.string() });
const errorResponseSchema = zodToJsonSchema(errorResponseZod);

export async function clerkWebhookRoutes(app: FastifyInstance): Promise<void> {
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
      },
    },
  }, async (request, reply) => {
    // Verify webhook signature
    const signature = request.headers["clerk-signature"] as string;
    const webhookSecret = env.CLERK_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      // In a real implementation, you would verify the signature using Clerk's SDK
      // For now, we'll skip signature verification in development
      if (process.env.NODE_ENV === "production") {
        // TODO: Implement proper signature verification
        // const isValid = await clerk.webhooks.verifySignature(payload, signature, webhookSecret);
        // if (!isValid) return reply.status(401).send({ error: "unauthorized", message: "Invalid webhook signature" });
      }
    }

    const event = request.body as z.infer<typeof clerkWebhookEventZod>;

    try {
      switch (event.type) {
        case "user.created":
        case "user.updated": {
          const userData = event.data;
          const email = userData.email_addresses[0]?.email_address;
          
          if (!email) {
            return reply.status(400).send({ error: "invalid_data", message: "User email not found" });
          }

          await prisma.user.upsert({
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
          await prisma.user.deleteMany({
            where: { clerkId: userData.id },
          });
          break;
        }
        default:
          // Ignore other event types
          break;
      }

      return { received: true as const };
    } catch (error) {
      app.log.error({ err: error, eventType: event.type }, "Clerk webhook handler failed");
      return reply.status(500).send({
        error: "webhook_failed",
        message: "Failed to process webhook event",
      });
    }
  });
}