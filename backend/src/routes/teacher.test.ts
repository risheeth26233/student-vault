import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import type { AuthenticatedRequest } from "../plugins/clerk-auth.js";
import { teacherRoutes } from "./teacher.js";

let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  app = Fastify();
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const actor = request.headers["x-test-actor"];
    if (actor === "student" || actor === "teacher") {
      (request as AuthenticatedRequest).dbUser = { id: `user-${actor}`, email: `${actor}@example.test`, name: actor, role: actor };
    }
  });
  await app.register(teacherRoutes);
});

afterEach(async () => app.close());

test("teacher endpoints require an authenticated account", async () => {
  const response = await app.inject({ method: "GET", url: "/api/teacher/classes" });
  assert.equal(response.statusCode, 401);
});

test("student accounts cannot call teacher class endpoints", async () => {
  const response = await app.inject({ method: "GET", url: "/api/teacher/classes", headers: { "x-test-actor": "student" } });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "forbidden");
});

test("teacher accounts cannot accept student enrollments", async () => {
  const response = await app.inject({ method: "POST", url: "/api/teacher/enrollments/accept", headers: { "x-test-actor": "teacher" }, payload: { joinCode: "valid-code-1234" } });
  assert.equal(response.statusCode, 403);
});
