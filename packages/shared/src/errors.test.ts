import { describe, expect, it } from "vitest";

import { AppError } from "./errors.js";
import type { ErrorCode } from "./errors.js";

describe("AppError", () => {
  const cases: [ErrorCode, number][] = [
    ["VALIDATION_ERROR", 400],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["INTERNAL_ERROR", 500],
  ];

  it.each(cases)("%s maps to status %d", (code, status) => {
    const err = new AppError(code, "test");
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
  });

  it("extends Error with correct message", () => {
    const err = new AppError("NOT_FOUND", "User not found");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("User not found");
  });

  it("toJSON returns correct shape", () => {
    const err = new AppError("FORBIDDEN", "Not allowed");
    expect(err.toJSON()).toEqual({
      error: { code: "FORBIDDEN", message: "Not allowed" },
    });
  });
});
