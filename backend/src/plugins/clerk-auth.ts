import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createClerkClient } from "@clerk/clerk-sdk-node";
import { prisma } from "../utils/prisma.js";
import { getEnv } from "../config/env.js";

const env = getEnv();

let clerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (!clerkClient && env.CLERK_SECRET_KEY) {
    clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  }
  return clerkClient;
}

export interface ClerkUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  clerkUser?: ClerkUser;
  dbUser?: {
    id: string;
    email: string;
    name: string;
  };
}

async function getOrCreateDbUser(clerkUser: ClerkUser) {
  const existingUser = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
  });

  if (existingUser) {
    // Update email and name if changed
    if (existingUser.email !== clerkUser.email || existingUser.name !== (clerkUser.firstName || clerkUser.username || "User")) {
      return prisma.user.update({
        where: { clerkId: clerkUser.id },
        data: {
          email: clerkUser.email,
          name: clerkUser.firstName || clerkUser.username || "User",
        },
      });
    }
    return existingUser;
  }

  // Create new user
  return prisma.user.create({
    data: {
      clerkId: clerkUser.id,
      email: clerkUser.email,
      name: clerkUser.firstName || clerkUser.username || "User",
    },
  });
}

export async function clerkAuthPlugin(app: FastifyInstance): Promise<void> {
  // Add Clerk user to request after verification
  app.addHook("preHandler", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    // Skip authentication for public routes
    const publicRoutes = ["/api/health"];
    if (publicRoutes.includes(request.routerPath || request.url)) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: "unauthorized",
        message: "Missing or invalid Authorization header",
      });
    }

    const sessionToken = authHeader.slice(7); // Remove "Bearer "
    const clerk = getClerkClient();

    if (!clerk) {
      app.log.error("Clerk not configured");
      return reply.status(503).send({
        error: "service_unavailable",
        message: "Authentication service not configured",
      });
    }

    try {
      // Verify the session token
      const session = await clerk.sessions.verifySession(sessionToken, sessionToken);
      
      // Get user details
      const user = await clerk.users.getUser(session.userId);
      
      const clerkUser: ClerkUser = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      // Get or create database user
      const dbUser = await getOrCreateDbUser(clerkUser);

      request.clerkUser = clerkUser;
      request.dbUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      };
    } catch (error) {
      app.log.error({ err: error }, "Clerk authentication failed");
      return reply.status(401).send({
        error: "unauthorized",
        message: "Invalid or expired session",
      });
    }
  });
}

export function getDbUserId(request: AuthenticatedRequest): string | null {
  return request.dbUser?.id || null;
}

export function getClerkUser(request: AuthenticatedRequest): ClerkUser | null {
  return request.clerkUser || null;
}