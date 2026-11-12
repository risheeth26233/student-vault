import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { youtubeRoutes } from "./youtube.js";

const app = Fastify();

before(async () => { await app.register(youtubeRoutes); });
after(async () => { await app.close(); });

test("reports YouTube as unconfigured and does not turn a missing API key into empty results", async () => {
  const status = await app.inject({ method: "GET", url: "/api/youtube/status" });
  assert.equal(status.statusCode, 200);
  assert.deepEqual(status.json(), { configured: false });

  const search = await app.inject({
    method: "POST",
    url: "/api/youtube/search",
    payload: { query: "biology photosynthesis" },
  });
  assert.equal(search.statusCode, 503);
  assert.equal(search.json().error, "service_unavailable");

  const video = await app.inject({ method: "GET", url: "/api/youtube/videos/video-1" });
  assert.equal(video.statusCode, 503);
});

test("rejects empty and oversized search queries", async () => {
  const empty = await app.inject({ method: "POST", url: "/api/youtube/search", payload: { query: " " } });
  assert.equal(empty.statusCode, 400);

  const oversized = await app.inject({ method: "POST", url: "/api/youtube/search", payload: { query: "x".repeat(501) } });
  assert.equal(oversized.statusCode, 400);
});
