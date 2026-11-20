import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createPublicId(): string {
  return `SV-${new Date().getFullYear()}-${Array.from({ length: 7 }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
}

export function createProfileRoutes(db: typeof prisma = prisma) {
  return async function profileRoutes(app: FastifyInstance): Promise<void> {
    app.get("/api/profile/public-id", async (request: AuthenticatedRequest, reply) => {
      const userId = request.dbUser?.id;
      if (!userId) return reply.status(401).send({ error: "unauthorized", message: "Sign in to view your Student-Vault ID" });

      for (let attempt = 0; attempt < 5; attempt++) {
        let user;
        try {
          user = await db.user.findUnique({ where: { id: userId }, select: { publicId: true } });
        } catch (error) {
          if (typeof error === "object" && error !== null && "code" in error && error.code === "P2022") {
            return reply.status(503).send({ error: "id_setup_pending", message: "Student-Vault ID setup is still being prepared. Please try again later." });
          }
          throw error;
        }
        if (!user) return reply.status(404).send({ error: "not_found", message: "Account not found" });
        if (user.publicId) return { publicId: user.publicId };

        try {
          const result = await db.user.updateMany({ where: { id: userId, publicId: null }, data: { publicId: createPublicId() } });
          if (result.count) continue;
        } catch (error) {
          if (typeof error === "object" && error !== null && "code" in error && error.code === "P2022") {
            return reply.status(503).send({ error: "id_setup_pending", message: "Student-Vault ID setup is still being prepared. Please try again later." });
          }
          if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
        }
      }

      const user = await db.user.findUnique({ where: { id: userId }, select: { publicId: true } });
      if (user?.publicId) return { publicId: user.publicId };
      return reply.status(503).send({ error: "id_unavailable", message: "Your Student-Vault ID could not be assigned. Please try again." });
    });
  };
}

export const profileRoutes = createProfileRoutes();
