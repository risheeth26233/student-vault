import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";

/** Preserve signed bytes while bounding memory before Fastify parses JSON. */
export function registerWebhookBody(app: FastifyInstance): void {
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.url.split("?")[0] !== "/api/webhooks/clerk") return payload;
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of payload) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > request.routeOptions.bodyLimit) {
        throw Object.assign(new Error("Request body is too large"), { statusCode: 413, code: "FST_ERR_CTP_BODY_TOO_LARGE" });
      }
      chunks.push(buffer);
    }
    request.rawBody = Buffer.concat(chunks);
    return Readable.from([request.rawBody]);
  });
}
