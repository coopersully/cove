import { describe, expect, it } from "vitest";

import { createTestUser } from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Auth Routes", () => {
  describe("POST /auth/register", () => {
    it("registers a new user and returns tokens", async () => {
      const { status, body } = await apiRequest("POST", "/auth/register", {
        body: {
          username: "newuser",
          email: "newuser@test.com",
          password: "Password1",
        },
      });

      expect(status).toBe(201);
      expect(body.user).toBeDefined();
      expect((body.user as Record<string, unknown>).username).toBe("newuser");
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it("rejects duplicate username", async () => {
      await createTestUser({ username: "taken" });

      const { status, body } = await apiRequest("POST", "/auth/register", {
        body: {
          username: "taken",
          email: "different@test.com",
          password: "Password1",
        },
      });

      expect(status).toBe(409);
      expect((body.error as Record<string, unknown>).code).toBe("CONFLICT");
    });

    it("rejects duplicate email", async () => {
      await createTestUser({ email: "taken@test.com" });

      const { status, body } = await apiRequest("POST", "/auth/register", {
        body: {
          username: "differentuser",
          email: "taken@test.com",
          password: "Password1",
        },
      });

      expect(status).toBe(409);
      expect((body.error as Record<string, unknown>).code).toBe("CONFLICT");
    });

    it("rejects invalid password", async () => {
      const { status } = await apiRequest("POST", "/auth/register", {
        body: {
          username: "newuser",
          email: "new@test.com",
          password: "weak",
        },
      });

      expect(status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("logs in with correct credentials", async () => {
      const user = await createTestUser({
        email: "login@test.com",
        password: "Password1",
      });

      const { status, body } = await apiRequest("POST", "/auth/login", {
        body: {
          email: "login@test.com",
          password: "Password1",
        },
      });

      expect(status).toBe(200);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect((body.user as Record<string, unknown>).username).toBe(user.username);
    });

    it("rejects wrong password", async () => {
      await createTestUser({
        email: "login@test.com",
        password: "Password1",
      });

      const { status, body } = await apiRequest("POST", "/auth/login", {
        body: {
          email: "login@test.com",
          password: "WrongPass1",
        },
      });

      expect(status).toBe(401);
      expect((body.error as Record<string, unknown>).code).toBe("UNAUTHORIZED");
    });

    it("rejects nonexistent email", async () => {
      const { status } = await apiRequest("POST", "/auth/login", {
        body: {
          email: "nobody@test.com",
          password: "Password1",
        },
      });

      expect(status).toBe(401);
    });
  });

  describe("POST /auth/refresh", () => {
    it("rotates refresh token", async () => {
      // Register to get a refresh token
      const { body: regBody } = await apiRequest("POST", "/auth/register", {
        body: {
          username: "refreshuser",
          email: "refresh@test.com",
          password: "Password1",
        },
      });

      const { status, body } = await apiRequest("POST", "/auth/refresh", {
        body: { refreshToken: regBody.refreshToken },
      });

      expect(status).toBe(200);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      // New refresh token should be different
      expect(body.refreshToken).not.toBe(regBody.refreshToken);
    });

    it("rejects invalid refresh token", async () => {
      const { status } = await apiRequest("POST", "/auth/refresh", {
        body: { refreshToken: "invalid-token" },
      });

      expect(status).toBe(401);
    });
  });

  describe("Protected routes", () => {
    it("rejects requests without token", async () => {
      const { status } = await apiRequest("GET", "/friends");
      expect(status).toBe(401);
    });

    it("rejects requests with invalid token", async () => {
      const { status } = await apiRequest("GET", "/friends", {
        token: "not-a-real-token",
      });
      expect(status).toBe(401);
    });
  });
});
