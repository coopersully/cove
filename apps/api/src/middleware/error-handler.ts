import { AppError } from "@hearth/shared";
import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as 400);
  }

  console.error("Unhandled error:", err);

  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
    500,
  );
};
