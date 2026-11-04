import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg",
};

/** Only the explicitly selected compiled frontend directory is public. */
export async function registerFrontend(app: FastifyInstance, directory: string): Promise<void> {
  const root = resolve(directory);
  await stat(resolve(root, "index.html")); // fail startup if the release artifact is missing
  app.get("/", async (_request, reply) => reply.redirect("/app/"));
  app.get("/app", async (_request, reply) => reply.redirect("/app/"));
  app.get<{ Params: { "*": string } }>("/app/*", async (request, reply) => {
    const relative = request.params["*"];
    const segments = relative.split(/[\\/]/);
    if (segments.some((segment) => segment.startsWith(".")) || relative.includes("\\") || relative.includes("\0")) {
      return reply.code(404).send({ error: "not_found" });
    }
    let file = resolve(root, relative || "index.html");
    if (!file.startsWith(root + sep)) return reply.code(404).send({ error: "not_found" });
    let info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      // SPA routes have no extension. Missing assets must never receive HTML.
      if (extname(relative) || relative.startsWith("assets/")) return reply.code(404).send({ error: "not_found" });
      file = resolve(root, "index.html");
      info = await stat(file);
    }
    const extension = extname(file);
    const type = contentTypes[extension];
    if (!type) return reply.code(404).send({ error: "not_found" }); // no source maps or arbitrary files
    reply.type(type).header("Cache-Control", relative.startsWith("assets/") && /-[\w-]{8,}\./.test(relative)
      ? "public, max-age=31536000, immutable" : "no-cache");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(createReadStream(file));
  });
}
