import { z } from "zod";

export function toJsonSchema<T extends z.ZodTypeAny>(schema: T) {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as Record<string, unknown>;
  if (!jsonSchema.required || !Array.isArray(jsonSchema.required)) {
    jsonSchema.required = [];
  }
  return jsonSchema;
}
