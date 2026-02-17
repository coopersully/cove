import { db, messages, serverMembers } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { describe, expect, it } from "vitest";

import { createTestChannel, createTestServer, createTestUser } from "../test-utils/factories.js";
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

describe("Reaction Routes", () => {
  describe("PUT /channels/:channelId/messages/:messageId/reactions/:emoji", () => {
    it("adds a reaction to a message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("is idempotent — adding same reaction twice succeeds", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const emoji = encodeURIComponent("🔥");
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`, {
        token: alice.token,
      });

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("rejects reaction from non-member", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: bob.token },
      );

      expect(status).toBe(403);
    });

    it("returns 404 for nonexistent message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/999999999999999999/reactions/${encodeURIComponent("👍")}`,
        { token: alice.token },
      );

      expect(status).toBe(404);
    });
  });

  describe("DELETE /channels/:channelId/messages/:messageId/reactions/:emoji", () => {
    it("removes own reaction", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const emoji = encodeURIComponent("👍");
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`, {
        token: alice.token,
      });

      const { status } = await apiRequest(
        "DELETE",
        `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("returns 204 even if reaction does not exist (idempotent)", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const { status } = await apiRequest(
        "DELETE",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });
  });

  describe("GET /channels/:channelId/messages (with reactions)", () => {
    it("returns aggregated reactions on messages", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      // Add bob as server member
      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const message = await createTestMessage(channel.id, alice.id, "React to me!");

      // Both users react with 👍, alice also reacts with 🔥
      const thumbs = encodeURIComponent("👍");
      const fire = encodeURIComponent("🔥");
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${thumbs}`,
        {
          token: alice.token,
        },
      );
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${thumbs}`,
        {
          token: bob.token,
        },
      );
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${fire}`, {
        token: alice.token,
      });

      // Fetch messages as alice
      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      expect(msg).toBeDefined();

      const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(reactions).toHaveLength(2);

      const thumbsReaction = reactions.find((r) => r.emoji === "👍");
      expect(thumbsReaction).toBeDefined();
      expect(thumbsReaction!.count).toBe(2);
      expect(thumbsReaction!.me).toBe(true);

      const fireReaction = reactions.find((r) => r.emoji === "🔥");
      expect(fireReaction).toBeDefined();
      expect(fireReaction!.count).toBe(1);
      expect(fireReaction!.me).toBe(true);
    });
  });
});
