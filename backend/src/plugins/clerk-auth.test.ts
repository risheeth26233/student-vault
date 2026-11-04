import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { clerkAuthPlugin, createClerkAuthPlugin } from "./clerk-auth.js";
import type { PrismaClient } from "@prisma/client";
import { getEnv } from "../config/env.js";
import type { createClerkClient, verifyToken } from "@clerk/backend";

const app = Fastify();

before(async () => {
  await clerkAuthPlugin(app);
  app.get("/api/private", async () => ({ ok: true }));
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/webhooks/clerk", async () => ({ signatureGuardRunsInRoute: true }));
});
after(async () => { await app.close(); });

test("applies auth as a root hook, while keeping health and signature-guarded webhook routes public to Clerk tokens", async () => {
  assert.equal((await app.inject({ method: "GET", url: "/api/private" })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/api/health" })).statusCode, 200);
  assert.equal((await app.inject({ method: "GET", url: "/api/webhooks/clerk" })).statusCode, 200);
});

test("verified identities get only allowlisted teacher roles and persistence outages return 503", async () => {
  for (const [subject, outage] of [["user_teacher", false], ["user_student", false], ["user_teacher", true]] as const) {
    let written: Record<string, unknown> | undefined;
    const db = { user: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => { if (outage) throw new Error("private database details"); written = data; return { id: "db-id", ...data }; },
    } } as unknown as PrismaClient;
    const service = { users: { getUser: async (id: string) => ({ id, firstName: "Synthetic", lastName: null, username: null,
      primaryEmailAddressId: "primary", emailAddresses: [{ id: "other", emailAddress: "other@example.invalid" }, { id: "primary", emailAddress: "primary@example.invalid" }], imageUrl: "", createdAt: 0, updatedAt: 0 }) } } as unknown as ReturnType<typeof createClerkClient>;
    const app = Fastify();
    await createClerkAuthPlugin({ db, client: () => service, config: { ...getEnv(), CLERK_SECRET_KEY: "synthetic", FRONTEND_URL: "https://example.invalid", TEACHER_CLERK_IDS: " user_teacher " },
      verify: (async (_token, options) => { assert.deepEqual(options?.authorizedParties, ["https://example.invalid"]); return { sub: subject }; }) as typeof verifyToken })(app);
    app.get("/api/whoami", async request => ({ role: (request as import('./clerk-auth.js').AuthenticatedRequest).dbUser?.role }));
    try {
      const response = await app.inject({ url: "/api/whoami", headers: { authorization: "Bearer synthetic-fixture" } });
      assert.equal(response.statusCode, outage ? 503 : 200);
      if (!outage) { assert.equal(response.json().role, subject === "user_teacher" ? "teacher" : "student"); assert.equal(written?.email, "primary@example.invalid"); }
      assert.ok(!response.body.includes("private database details"));
    } finally { await app.close(); }
  }
});

test("invalid bearer tokens never trigger database provisioning", async () => {
  const app = Fastify();
  let lookups = 0;
  await createClerkAuthPlugin({ client: () => ({ users: { getUser: async () => { lookups++; } } }) as unknown as ReturnType<typeof createClerkClient>,
    verify: (async () => { throw new Error("invalid signature"); }) as typeof verifyToken })(app);
  app.get('/api/private', async () => ({ ok: true }));
  try { assert.equal((await app.inject({ url: '/api/private', headers: { authorization: 'Bearer invalid-fixture' } })).statusCode, 401); assert.equal(lookups, 0); }
  finally { await app.close(); }
});
