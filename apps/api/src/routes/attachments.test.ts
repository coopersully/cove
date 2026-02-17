import { attachments, db } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

// Helper: insert an attachment directly for tests that need to skip upload
async function createTestAttachment(
  messageId: string,
  overrides: { filename?: string; contentType?: string; size?: number; url?: string } = {},
) {
  const id = generateSnowflake();
  const [created] = await db
    .insert(attachments)
    .values({
      id: BigInt(id),
      messageId: BigInt(messageId),
      filename: overrides.filename ?? "test.png",
      contentType: overrides.contentType ?? "image/png",
      size: overrides.size ?? 1024,
      url: overrides.url ?? `/uploads/test/${id}.png`,
    })
    .returning();
  return { id, ...created! };
}

describe("Attachment Routes", () => {
  describe("POST /channels/:channelId/messages (with attachments)", () => {
    it("creates a message with empty attachments by default", async () => {
      const alice = await createTestUser({ username: "att_alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "No attachments" },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      expect(msg.attachments).toEqual([]);
      expect(msg.embeds).toEqual([]);
    });

    it("creates a message and links existing attachments", async () => {
      const alice = await createTestUser({ username: "att_alice2" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      // Create an unlinked attachment (uploaded before message creation)
      const attachmentId = generateSnowflake();
      await db.insert(attachments).values({
        id: BigInt(attachmentId),
        messageId: null,
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 2048,
        url: "/uploads/test/photo.jpg",
      });

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Check this out!", attachmentIds: [attachmentId] },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      const msgAttachments = msg.attachments as Array<Record<string, unknown>>;
      expect(msgAttachments).toHaveLength(1);
      expect(msgAttachments[0]!.filename).toBe("photo.jpg");
      expect(msgAttachments[0]!.contentType).toBe("image/jpeg");
      expect(msgAttachments[0]!.size).toBe(2048);
      expect(msgAttachments[0]!.url).toBe("/uploads/test/photo.jpg");
    });
  });

  describe("GET /channels/:channelId/messages (with attachments)", () => {
    it("includes attachments when listing messages", async () => {
      const alice = await createTestUser({ username: "att_alice3" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      // Create message then add attachment
      const { body: createBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Has attachment" },
      });
      const messageId = (createBody.message as Record<string, unknown>).id as string;

      await createTestAttachment(messageId, {
        filename: "doc.pdf",
        contentType: "application/pdf",
        size: 5000,
      });

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const messages = body.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(1);
      const attachmentList = messages[0]!.attachments as Array<Record<string, unknown>>;
      expect(attachmentList).toHaveLength(1);
      expect(attachmentList[0]!.filename).toBe("doc.pdf");
      expect(attachmentList[0]!.contentType).toBe("application/pdf");
      expect(attachmentList[0]!.size).toBe(5000);
    });

    it("returns empty attachments array for messages without attachments", async () => {
      const alice = await createTestUser({ username: "att_alice4" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Plain message" },
      });

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const messages = body.messages as Array<Record<string, unknown>>;
      expect(messages[0]!.attachments).toEqual([]);
    });

    it("returns attachments for multiple messages in batch", async () => {
      const alice = await createTestUser({ username: "att_alice5" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      // Create two messages
      const { body: msg1Body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "First" },
      });
      const { body: msg2Body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Second" },
      });

      const msg1Id = (msg1Body.message as Record<string, unknown>).id as string;
      const msg2Id = (msg2Body.message as Record<string, unknown>).id as string;

      await createTestAttachment(msg1Id, { filename: "a.png" });
      await createTestAttachment(msg2Id, { filename: "b.png" });
      await createTestAttachment(msg2Id, { filename: "c.png" });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      const messages = body.messages as Array<Record<string, unknown>>;
      // Messages are sorted DESC
      const secondMsg = messages.find(
        (m) => m.content === "Second",
      ) as Record<string, unknown>;
      const firstMsg = messages.find(
        (m) => m.content === "First",
      ) as Record<string, unknown>;

      expect((secondMsg.attachments as unknown[]).length).toBe(2);
      expect((firstMsg.attachments as unknown[]).length).toBe(1);
    });
  });

  describe("GET /attachments/:id", () => {
    it("returns attachment details", async () => {
      const alice = await createTestUser({ username: "att_alice6" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { body: createBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Msg with att" },
      });
      const messageId = (createBody.message as Record<string, unknown>).id as string;

      const att = await createTestAttachment(messageId, {
        filename: "report.pdf",
        contentType: "application/pdf",
        size: 12345,
      });

      const { status, body } = await apiRequest("GET", `/attachments/${att.id}`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const attachment = body.attachment as Record<string, unknown>;
      expect(attachment.filename).toBe("report.pdf");
      expect(attachment.contentType).toBe("application/pdf");
      expect(attachment.size).toBe(12345);
    });

    it("returns 404 for non-existent attachment", async () => {
      const alice = await createTestUser({ username: "att_alice7" });

      const { status } = await apiRequest("GET", `/attachments/${generateSnowflake()}`, {
        token: alice.token,
      });

      expect(status).toBe(404);
    });
  });

  describe("Attachment cascading on message delete", () => {
    it("deletes attachments when message is deleted", async () => {
      const alice = await createTestUser({ username: "att_alice8" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { body: createBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Will be deleted" },
      });
      const messageId = (createBody.message as Record<string, unknown>).id as string;

      const att = await createTestAttachment(messageId);

      // Delete the message
      await apiRequest("DELETE", `/messages/${messageId}`, {
        token: alice.token,
      });

      // Verify attachment is gone
      const rows = await db
        .select()
        .from(attachments)
        .where(eq(attachments.id, BigInt(att.id)));
      expect(rows).toHaveLength(0);
    });
  });
});
