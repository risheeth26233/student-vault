import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedRequest } from "./clerk-auth.js";

interface RateRule {
  prefix: string;
  limit: number;
  windowMs: number;
}

interface RequestLimitOptions {
  now?: () => number;
  rules?: RateRule[];
  maxBuckets?: number;
}

const defaultRules: RateRule[] = [
  { prefix: "/api/ai/chat", limit: 15, windowMs: 60_000 },
  { prefix: "/api/ai/study", limit: 5, windowMs: 60_000 },
  { prefix: "/api/handwriting/extract", limit: 5, windowMs: 60_000 },
  { prefix: "/api/images/generate", limit: 4, windowMs: 60_000 },
  { prefix: "/api/search", limit: 30, windowMs: 60_000 },
  { prefix: "/api/youtube/search", limit: 30, windowMs: 60_000 },
];

export function createRequestLimitHook(options: RequestLimitOptions = {}) {
  const now = options.now ?? Date.now;
  const rules = options.rules ?? defaultRules;
  const maxBuckets = options.maxBuckets ?? 10_000;
  const buckets = new Map<string, { startedAt: number; count: number }>();
  let calls = 0;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const rule = rules.find((candidate) => request.url.startsWith(candidate.prefix));
    const userId = (request as AuthenticatedRequest).dbUser?.id;
    if (!rule || !userId) return;

    const time = now();
    const key = `${userId}:${rule.prefix}`;
    let bucket = buckets.get(key);
    if (!bucket || time - bucket.startedAt >= rule.windowMs) {
      bucket = { startedAt: time, count: 0 };
      buckets.set(key, bucket);
    }

    if (++calls % 128 === 0) {
      for (const [bucketKey, value] of buckets) {
        if (time - value.startedAt >= rule.windowMs) buckets.delete(bucketKey);
      }
    }
    while (buckets.size > maxBuckets) {
      const oldest = buckets.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }

    if (bucket.count >= rule.limit) {
      const retrySeconds = Math.max(1, Math.ceil((rule.windowMs - (time - bucket.startedAt)) / 1000));
      reply.header("Retry-After", String(retrySeconds));
      reply.status(429).send({ error: "rate_limited", message: "Too many requests. Wait before retrying." });
      return;
    }
    bucket.count += 1;
  };
}

export async function registerRequestLimits(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", createRequestLimitHook());
}
