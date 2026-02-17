import { describe, expect, it } from "vitest";

import { createTestDm, createTestFriendship, createTestUser } from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("DM Routes", () => {
  describe("POST /dms", () => {
    it("creates a DM with a friend", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });

      await createTestFriendship(alice.id, bob.id, "accepted");

      const { status, body } = await apiRequest("POST", "/dms", {
        token: alice.token,
        body: { recipientId: bob.id },
      });

      expect(status).toBe(201);
      expect(body.channel).toBeDefined();
      const channel = body.channel as Record<string, unknown>;
      expect(channel.type).toBe("dm");
      expect(channel.serverId).toBeNull();
    });

    it("rejects DM without friendship", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });

      const { status, body } = await apiRequest("POST", "/dms", {
        token: alice.token,
        body: { recipientId: bob.id },
      });

      expect(status).toBe(403);
      expect((body.error as Record<string, unknown>).message).toContain("friends");
    });

    it("rejects DM with yourself", async () => {
      const alice = await createTestUser({ username: "alice" });

      const { status } = await apiRequest("POST", "/dms", {
        token: alice.token,
        body: { recipientId: alice.id },
      });

      expect(status).toBe(400);
    });

    it("returns existing channel for duplicate DM creation", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });

      await createTestFriendship(alice.id, bob.id, "accepted");

      const { body: first } = await apiRequest("POST", "/dms", {
        token: alice.token,
        body: { recipientId: bob.id },
      });

      const { status, body: second } = await apiRequest("POST", "/dms", {
        token: alice.token,
        body: { recipientId: bob.id },
      });

      // Second call returns the existing channel (200, not 201)
      expect(status).toBe(200);
      expect((second.channel as Record<string, unknown>).id).toBe(
        (first.channel as Record<string, unknown>).id,
      );
    });
  });

  describe("GET /dms", () => {
    it("lists DM channels with recipient info", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });

      await createTestDm(alice.id, bob.id);

      const { status, body } = await apiRequest("GET", "/dms", {
        token: alice.token,
      });

      expect(status).toBe(200);
      const channels = body.channels as Record<string, unknown>[];
      expect(channels).toHaveLength(1);
      expect((channels[0]?.recipient as Record<string, unknown>).username).toBe("bob");
    });

    it("returns empty list when no DMs", async () => {
      const alice = await createTestUser({ username: "alice" });

      const { status, body } = await apiRequest("GET", "/dms", {
        token: alice.token,
      });

      expect(status).toBe(200);
      expect(body.channels).toEqual([]);
    });
  });
});
