import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";

export function createReadinessRoutes(
  probe: () => Promise<unknown> = () => prisma.$queryRaw`SELECT 1`,
  timeoutMs = 2_000,
) {
  return async function readinessRoutes(app: FastifyInstance): Promise<void> {
    let pending: Promise<boolean> | undefined;
    let cached: { ready: boolean; expires: number } | undefined;
    app.get("/api/ready", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      let ready = cached && cached.expires > Date.now() ? cached.ready : undefined;
      if (ready === undefined) {
        // Reuse an outstanding query even after an HTTP timeout, so an outage
        // cannot accumulate new database queries on every health probe.
        pending ??= Promise.resolve().then(probe).then(() => true, () => false)
          .finally(() => { pending = undefined; });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          ready = await Promise.race([
            pending,
            new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
          ]);
        } finally { if (timer) clearTimeout(timer); }
        cached = { ready, expires: Date.now() + 2_000 };
      }
      return reply.status(ready ? 200 : 503).send({ status: ready ? "ready" : "unavailable" });
    });
  };
}

export const readinessRoutes = createReadinessRoutes();
