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

    it("rejects reaction without authentication", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
      );

      expect(status).toBe(401);
    });

    it("allows multiple different emojis from the same user", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const thumbs = encodeURIComponent("👍");
      const fire = encodeURIComponent("🔥");
      const heart = encodeURIComponent("❤️");

      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${thumbs}`, {
        token: alice.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${fire}`, {
        token: alice.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${heart}`, {
        token: alice.token,
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(reactions).toHaveLength(3);
      for (const r of reactions) {
        expect(r.count).toBe(1);
        expect(r.me).toBe(true);
      }
    });

    it("allows reactions in DM channels", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const dm = await createTestDm(alice.id, bob.id);
      const message = await createTestMessage(dm.channelId, alice.id, "DM message");

      const { status } = await apiRequest(
        "PUT",
        `/channels/${dm.channelId}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: bob.token },
      );

      expect(status).toBe(204);
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

    it("removing a reaction decrements the count in GET messages", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const message = await createTestMessage(channel.id, alice.id, "React to me");

      const emoji = encodeURIComponent("👍");
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`, {
        token: alice.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`, {
        token: bob.token,
      });

      // Alice removes her reaction
      await apiRequest(
        "DELETE",
        `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`,
        { token: alice.token },
      );

      // Verify count is now 1 and me=false for alice
      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(reactions).toHaveLength(1);
      expect(reactions[0]!.count).toBe(1);
      expect(reactions[0]!.me).toBe(false);
    });

    it("removing the last reaction results in empty reactions array", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const emoji = encodeURIComponent("👍");
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`, {
        token: alice.token,
      });
      await apiRequest(
        "DELETE",
        `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`,
        { token: alice.token },
      );

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(reactions).toHaveLength(0);
    });
  });

  describe("GET /channels/:channelId/messages (with reactions)", () => {
    it("returns aggregated reactions on messages", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const message = await createTestMessage(channel.id, alice.id, "React to me!");

      const thumbs = encodeURIComponent("👍");
      const fire = encodeURIComponent("🔥");
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${thumbs}`,
        { token: alice.token },
      );
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${thumbs}`,
        { token: bob.token },
      );
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${fire}`,
        { token: alice.token },
      );

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

    it("me field is false when viewing as a user who has not reacted", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const message = await createTestMessage(channel.id, alice.id, "React to me!");

      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: alice.token },
      );

      // Fetch as bob — should see me=false
      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: bob.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(reactions).toHaveLength(1);
      expect(reactions[0]!.emoji).toBe("👍");
      expect(reactions[0]!.count).toBe(1);
      expect(reactions[0]!.me).toBe(false);
    });

    it("returns empty reactions array for messages with no reactions", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      await createTestMessage(channel.id, alice.id, "No reactions here");

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.reactions).toEqual([]);
    });

    it("reactions from multiple users are correctly aggregated across messages", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const charlie = await createTestUser({ username: "charlie" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values([
        { serverId: BigInt(server.id), userId: BigInt(bob.id) },
        { serverId: BigInt(server.id), userId: BigInt(charlie.id) },
      ]);

      const msg1 = await createTestMessage(channel.id, alice.id, "Message 1");
      const msg2 = await createTestMessage(channel.id, alice.id, "Message 2");

      const thumbs = encodeURIComponent("👍");

      // All three react to msg1, only alice reacts to msg2
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${msg1.id}/reactions/${thumbs}`,
        { token: alice.token },
      );
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${msg1.id}/reactions/${thumbs}`,
        { token: bob.token },
      );
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${msg1.id}/reactions/${thumbs}`,
        { token: charlie.token },
      );
      await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${msg2.id}/reactions/${thumbs}`,
        { token: alice.token },
      );

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: bob.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;

      const m1 = msgs.find((m) => m.id === msg1.id);
      const m1Reactions = m1!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(m1Reactions).toHaveLength(1);
      expect(m1Reactions[0]!.count).toBe(3);
      expect(m1Reactions[0]!.me).toBe(true); // bob reacted

      const m2 = msgs.find((m) => m.id === msg2.id);
      const m2Reactions = m2!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(m2Reactions).toHaveLength(1);
      expect(m2Reactions[0]!.count).toBe(1);
      expect(m2Reactions[0]!.me).toBe(false); // bob did not react to msg2
    });
  });
});
