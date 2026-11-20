import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";
import type { prisma } from "../utils/prisma.js";
import { createProfileRoutes } from "./profile.js";

const account = { publicId: null as string | null };
let failCollision = false;
let missingColumn = false;
const db = {
  user: {
    findUnique: async () => { if (missingColumn) throw { code: "P2022" }; return { publicId: account.publicId }; },
    updateMany: async ({ data }: { data: { publicId: string } }) => {
      if (failCollision) { failCollision = false; throw { code: "P2002" }; }
      account.publicId = data.publicId;
      return { count: 1 };
    },
  },
} as unknown as typeof prisma;
let app: ReturnType<typeof Fastify>;

afterEach(async () => { account.publicId = null; failCollision = false; missingColumn = false; await app?.close(); });

test("public Student-Vault ID is assigned once and remains stable", async () => {
  app = Fastify();
  app.addHook("preHandler", async (request: FastifyRequest) => { (request as AuthenticatedRequest).dbUser = { id: "account-1", role: "student", email: "a@example.test", name: "A" }; });
  await app.register(createProfileRoutes(db));
  const first = await app.inject({ method: "GET", url: "/api/profile/public-id" });
  const second = await app.inject({ method: "GET", url: "/api/profile/public-id" });
  assert.equal(first.statusCode, 200);
  assert.match(first.json().publicId, /^SV-\d{4}-[A-HJ-NP-Z2-9]{7}$/);
  assert.deepEqual(second.json(), first.json());
});

test("public ID assignment retries a uniqueness collision", async () => {
  app = Fastify();
  failCollision = true;
  app.addHook("preHandler", async (request: FastifyRequest) => { (request as AuthenticatedRequest).dbUser = { id: "account-1", role: "student", email: "a@example.test", name: "A" }; });
  await app.register(createProfileRoutes(db));
  const response = await app.inject({ method: "GET", url: "/api/profile/public-id" });
  assert.equal(response.statusCode, 200);
  assert.match(response.json().publicId, /^SV-/);
});

test("public ID cannot be requested without an authenticated account", async () => {
  app = Fastify();
  await app.register(createProfileRoutes(db));
  const response = await app.inject({ method: "GET", url: "/api/profile/public-id" });
  assert.equal(response.statusCode, 401);
});

test("public ID explains when its additive database migration is pending", async () => {
  app = Fastify();
  missingColumn = true;
  app.addHook("preHandler", async (request: FastifyRequest) => { (request as AuthenticatedRequest).dbUser = { id: "account-1", role: "student", email: "a@example.test", name: "A" }; });
  await app.register(createProfileRoutes(db));
  const response = await app.inject({ method: "GET", url: "/api/profile/public-id" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "id_setup_pending");
});
