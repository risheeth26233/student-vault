import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { registerFrontend } from "./frontend.js";
import { clerkAuthPlugin } from "../plugins/clerk-auth.js";

test("release serves modern SPA publicly while APIs and private files remain protected", async () => {
  const root = await mkdtemp(join(tmpdir(), "sv-release-"));
  const app = Fastify();
  try {
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "index.html"), "<!doctype html><title>Student Vault</title>");
    await writeFile(join(root, "assets", "index-12345678.js"), "export {};");
    await writeFile(join(root, ".env"), "secret");
    await writeFile(join(root, "bundle.js.map"), "private source");
    await registerFrontend(app, root);
    await clerkAuthPlugin(app);
    app.get("/api/topics", async () => ({ topics: [] }));
    assert.equal((await app.inject("/")).headers.location, "/app/");
    for (const path of ["/app/", "/app/teacher", "/app/handwriting"]) {
      const response = await app.inject(path);
      assert.equal(response.statusCode, 200);
      assert.match(String(response.headers["content-type"]), /text\/html/);
      assert.equal(response.headers["cache-control"], "no-cache");
    }
    const asset = await app.inject("/app/assets/index-12345678.js");
    assert.equal(asset.statusCode, 200);
    assert.match(String(asset.headers["cache-control"]), /immutable/);
    for (const path of ["/app/.env", "/app/%2eenv", "/app/bundle.js.map", "/app/assets/missing.js", "/app/..%5c.env"]) {
      assert.equal((await app.inject(path)).statusCode, 404, path);
    }
    assert.equal((await app.inject("/api/topics")).statusCode, 401);
    assert.equal((await app.inject("/api/missing")).statusCode, 401);
  } finally { await app.close(); await rm(root, { recursive: true, force: true }); }
});
