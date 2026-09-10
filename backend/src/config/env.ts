import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  // AI Services
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // YouTube
  YOUTUBE_API_KEY: z.string().optional(),

  // Web Search
  BRAVE_SEARCH_API_KEY: z.string().optional(),

  // Image Generation
  FAL_API_KEY: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Cloudflare R2 / S3
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  // Authentication (Clerk)
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Email
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}

export function validateRequired(keys: (keyof Env)[]): void {
  const env = getEnv();
  const missing = keys.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function isServiceEnabled(service: "ai" | "youtube" | "search" | "images" | "auth"): boolean {
  const env = getEnv();
  switch (service) {
    case "ai":
      return Boolean(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY);
    case "youtube":
      return Boolean(env.YOUTUBE_API_KEY);
    case "search":
      return Boolean(env.BRAVE_SEARCH_API_KEY);
    case "images":
      return Boolean(env.FAL_API_KEY || env.OPENAI_API_KEY);
    case "auth":
      return Boolean(env.CLERK_SECRET_KEY);
    default:
      return false;
  }
}

export function requireService(service: "ai" | "youtube" | "search" | "images"): void {
  if (!isServiceEnabled(service)) {
    throw new Error(`Service "${service}" is not configured. Required environment variables are missing.`);
  }
}