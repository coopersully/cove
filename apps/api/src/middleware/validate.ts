import { AppError } from "@cove/shared";
import type { MiddlewareHandler } from "hono";
import type { z } from "zod";

export function validate<T extends z.ZodType>(
  schema: T,
): MiddlewareHandler<{ Variables: { body: z.infer<T> } }> {
  return async (c, next): Promise<void> => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON");
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      throw new AppError("VALIDATION_ERROR", firstIssue?.message ?? "Invalid input");
    }

    c.set("body", result.data as never);
    await next();
  };
}
