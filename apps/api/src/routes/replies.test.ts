import { db, messages } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
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

describe("Reply Routes", () => {
  describe("POST /channels/:channelId/messages (with replyToId)", () => {
    it("creates a reply to an existing message", async () => {
      const alice = await createTestUser();
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const original = await createTestMessage(channel.id, alice.id, "Original message");

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "This is a reply", replyToId: original.id },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      expect(msg.replyToId).toBe(original.id);
      expect(msg.referencedMessage).toBeDefined();
      const ref = msg.referencedMessage as Record<string, unknown>;
      expect(ref.id).toBe(original.id);
      expect(ref.content).toBe("Original message");
    });

    it("creates a message without replyToId (normal message)", async () => {
      const alice = await createTestUser();
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Normal message" },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      expect(msg.replyToId).toBeNull();
      expect(msg.referencedMessage).toBeNull();
    });

    it("returns 404 for reply to nonexistent message", async () => {
      const alice = await createTestUser();
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Reply to nothing", replyToId: "999999999999999999" },
      });

      expect(status).toBe(404);
    });

    it("shows null referencedMessage when original is deleted", async () => {
      const alice = await createTestUser();
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const original = await createTestMessage(channel.id, alice.id, "Will be deleted");

      // Create reply
      const { body: replyBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "This is a reply", replyToId: original.id },
      });

      // Delete original
      await apiRequest("DELETE", `/messages/${original.id}`, { token: alice.token });

      // Fetch messages — reply should have replyToId but null referencedMessage
      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      const msgs = body.messages as Array<Record<string, unknown>>;
      const reply = msgs.find(
        (m) => m.id === (replyBody.message as Record<string, unknown>).id,
      );
      expect(reply).toBeDefined();
      expect(reply!.replyToId).toBeNull(); // SET NULL on delete
      expect(reply!.referencedMessage).toBeNull();
    });
  });

  describe("GET /channels/:channelId/messages (with replies)", () => {
    it("includes referencedMessage in message list", async () => {
      const alice = await createTestUser();
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { body: origBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Original" },
      });
      const origId = (origBody.message as Record<string, unknown>).id as string;

      await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Reply", replyToId: origId },
      });

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const msgs = body.messages as Array<Record<string, unknown>>;
      const reply = msgs.find((m) => m.content === "Reply");
      expect(reply).toBeDefined();
      expect(reply!.replyToId).toBe(origId);
      const ref = reply!.referencedMessage as Record<string, unknown>;
      expect(ref.content).toBe("Original");
    });
  });
});
