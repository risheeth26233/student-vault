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
    await mkdir(join(root, "demo"));
    await writeFile(join(root, "demo", "demo.mp4"), "0123456789");
    await writeFile(join(root, "demo", "demo.vtt"), "WEBVTT\n\n");
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
    const video = await app.inject("/app/demo/demo.mp4");
    assert.equal(video.statusCode, 200);
    assert.equal(video.headers["content-type"], "video/mp4");
    assert.equal(video.headers["content-length"], "10");
    for (const [range, body, contentRange] of [["bytes=2-5", "2345", "bytes 2-5/10"], ["bytes=-3", "789", "bytes 7-9/10"], ["bytes=8-", "89", "bytes 8-9/10"]]) {
      const response = await app.inject({ url: "/app/demo/demo.mp4", headers: { range } });
      assert.equal(response.statusCode, 206);
      assert.equal(response.body, body);
      assert.equal(response.headers["content-range"], contentRange);
    }
    for (const range of ["bytes=100-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=0-2,4-5"]) {
      assert.equal((await app.inject({ url: "/app/demo/demo.mp4", headers: { range } })).statusCode, 416);
    }
    assert.match(String((await app.inject("/app/demo/demo.vtt")).headers["content-type"]), /text\/vtt/);
    for (const path of ["/app/.env", "/app/%2eenv", "/app/bundle.js.map", "/app/assets/missing.js", "/app/..%5c.env"]) {
      assert.equal((await app.inject(path)).statusCode, 404, path);
    }
    assert.equal((await app.inject("/api/topics")).statusCode, 401);
    assert.equal((await app.inject("/api/missing")).statusCode, 401);
  } finally { await app.close(); await rm(root, { recursive: true, force: true }); }
});
