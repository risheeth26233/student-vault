import "dotenv/config";
import { registerWebhookBody } from "./plugins/webhook-body.js";
import Fastify from "fastify";
import type { FastifyError } from "fastify";
import { loadEnv } from "./config/env.js";
import { clerkAuthPlugin } from "./plugins/clerk-auth.js";
import { registerRequestLimits } from "./plugins/request-limits.js";
import { initializeAIProviders } from "./services/ai.js";
import { initializeYouTubeProvider } from "./services/youtube.js";
import { initializeSearchProvider } from "./services/search.js";
import { initializeImageProvider } from "./services/images.js";
import { initializeOcrProvider } from "./services/ocr.js";
import { healthRoutes } from "./routes/health.js";
import { readinessRoutes } from "./routes/readiness.js";
import { aiRoutes } from "./routes/ai.js";
import { aiStudyRoutes } from "./routes/ai-study.js";
import { youtubeRoutes } from "./routes/youtube.js";
import { searchRoutes } from "./routes/search.js";
import { imagesRoutes } from "./routes/images.js";
import { topicsRoutes } from "./routes/topics.js";
import { attendanceRoutes } from "./routes/attendance.js";
import { assignmentsRoutes } from "./routes/assignments.js";
import { assessmentsRoutes } from "./routes/assessments.js";
import { resourcesRoutes } from "./routes/resources.js";
import { handwritingRoutes } from "./routes/handwriting.js";
import { importRoutes } from "./routes/import.js";
import { clerkWebhookRoutes } from "./routes/clerk-webhook.js";
import { syncRoutes } from "./routes/sync.js";
import { teacherRoutes } from "./routes/teacher.js";
import { prisma } from "./utils/prisma.js";
import { registerFrontend } from "./routes/frontend.js";

// Load and validate environment
loadEnv();

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.apiKey",
        "*.secret",
        "*.token",
        "*.password",
      ],
      censor: "[REDACTED]",
    },
  },
});

// Security headers
await app.register(import("@fastify/helmet"), {
  contentSecurityPolicy: false, // We'll set CSP via frontend meta tag
  crossOriginEmbedderPolicy: false,
});

// CORS configuration
const env = loadEnv();
await app.register(import("@fastify/cors"), {
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Clerk authentication
if (process.env.FRONTEND_DIST_DIR) await registerFrontend(app, process.env.FRONTEND_DIST_DIR);
registerWebhookBody(app);
await clerkAuthPlugin(app);
await registerRequestLimits(app);

// Register routes
await app.register(healthRoutes);
await app.register(readinessRoutes);
await app.register(aiRoutes);
await app.register(aiStudyRoutes);
await app.register(youtubeRoutes);
await app.register(searchRoutes);
await app.register(imagesRoutes);
await app.register(topicsRoutes);
await app.register(attendanceRoutes);
await app.register(assignmentsRoutes);
await app.register(assessmentsRoutes);
await app.register(resourcesRoutes);
await app.register(handwritingRoutes);
await app.register(importRoutes);
await app.register(clerkWebhookRoutes);
await app.register(syncRoutes);
await app.register(teacherRoutes);

// Global error handler
app.setErrorHandler<FastifyError>((error, request, reply) => {
  app.log.error({ errorName: error.name, errorCode: error.code, statusCode: error.statusCode }, "Request failed");

  // Validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: "validation_error",
      message: "Invalid request data",
      details: error.validation,
    });
  }

  // Known error codes
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : error.message;

  return reply.status(statusCode).send({
    error: error.code || "internal_error",
    message,
  });
});

// 404 handler
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: "not_found",
    message: `Route ${request.method} ${request.url} not found`,
  });
});

async function start(): Promise<void> {
  try {
    // Initialize AI providers
    await initializeAIProviders();
    // Initialize YouTube provider
    await initializeYouTubeProvider();
    // Initialize Search provider
    await initializeSearchProvider();
    // Initialize Image provider
    await initializeImageProvider();
    // Initialize handwritten-work OCR provider (Phase 3)
    initializeOcrProvider();
    
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`Server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

app.addHook("onClose", async () => { await prisma.$disconnect(); });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}

start();
