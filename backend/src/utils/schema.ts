import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

export function toJsonSchema<T extends z.ZodTypeAny>(schema: T) {
  const jsonSchema = zodToJsonSchema(schema, { target: "jsonSchema7" }) as Record<string, unknown>;
  if (!jsonSchema.required || !Array.isArray(jsonSchema.required)) {
    jsonSchema.required = [];
  }
  return jsonSchema;
}