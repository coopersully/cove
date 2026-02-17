import { db, messages, serverMembers } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestDm,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

async function createTestMessage(channelId: string, authorId: string, content = "test") {
  const id = generateSnowflake();
  await db.insert(messages).values({
    id: BigInt(id),
    channelId: BigInt(channelId),
    authorId: BigInt(authorId),
    content,
  });
  return { id };
}

describe("Pin Routes", () => {
  describe("PUT /channels/:channelId/pins/:messageId", () => {
    it("pins a message as server owner", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      expect(status).toBe(204);
    });

    it("rejects pin from member without MANAGE_MESSAGES", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: bob.token,
      });

      expect(status).toBe(403);
    });

    it("pinning an already-pinned message is idempotent", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      expect(status).toBe(204);

      // Verify it only appears once in the pins list
      const { body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: alice.token,
      });
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(1);
    });

    it("returns 404 for nonexistent message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/pins/999999999999999999`,
        { token: alice.token },
      );

      expect(status).toBe(404);
    });

    it("rejects pin without authentication", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`);

      expect(status).toBe(401);
    });

    it("rejects pin from non-member", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: bob.token,
      });

      expect(status).toBe(403);
    });

    it("allows pinning in DM channels by either participant", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const dm = await createTestDm(alice.id, bob.id);
      const message = await createTestMessage(dm.channelId, alice.id, "Pin this DM");

      const { status } = await apiRequest("PUT", `/channels/${dm.channelId}/pins/${message.id}`, {
        token: bob.token,
      });

      expect(status).toBe(204);
    });
  });

  describe("DELETE /channels/:channelId/pins/:messageId", () => {
    it("unpins a pinned message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      const { status } = await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      expect(status).toBe(204);

      // Verify it's removed from the pins list
      const { body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: alice.token,
      });
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(0);
    });

    it("unpinning a non-pinned message succeeds (idempotent)", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Not pinned");

      const { status } = await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      expect(status).toBe(204);
    });

    it("rejects unpin from member without MANAGE_MESSAGES", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      const { status } = await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: bob.token,
      });

      expect(status).toBe(403);
    });
  });

  describe("GET /channels/:channelId/pins", () => {
    it("lists pinned messages", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const msg1 = await createTestMessage(channel.id, alice.id, "First pinned");
      const msg2 = await createTestMessage(channel.id, alice.id, "Second pinned");
      await createTestMessage(channel.id, alice.id, "Not pinned");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${msg1.id}`, {
        token: alice.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/pins/${msg2.id}`, {
        token: alice.token,
      });

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(2);
    });

    it("returns empty array when nothing is pinned", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(0);
    });

    it("rejects pin listing from non-member", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: bob.token,
      });

      expect(status).toBe(403);
    });

    it("includes author info and pinnedAt/pinnedBy in pin responses", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pinned with details");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: alice.token,
      });
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(1);

      const pin = pins[0]!;
      expect(pin.id).toBe(message.id);
      expect(pin.content).toBe("Pinned with details");
      expect(pin.pinnedAt).toBeDefined();
      expect(pin.pinnedBy).toBe(alice.id);
      expect(pin.author).toBeDefined();
      const author = pin.author as Record<string, unknown>;
      expect(author.username).toBe("alice");
    });

    it("pinnedAt and pinnedBy appear in GET messages response", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin visible in messages");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      expect(msg).toBeDefined();
      expect(msg!.pinnedAt).toBeDefined();
      expect(msg!.pinnedAt).not.toBeNull();
      expect(msg!.pinnedBy).toBe(alice.id);
    });

    it("unpinned messages have null pinnedAt/pinnedBy in GET messages response", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin then unpin");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });
      await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      expect(msg).toBeDefined();
      expect(msg!.pinnedAt).toBeNull();
      expect(msg!.pinnedBy).toBeNull();
    });
  });
});
