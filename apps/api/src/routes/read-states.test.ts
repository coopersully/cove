import { describe, expect, it } from "vitest";

import { createTestChannel, createTestServer, createTestUser } from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Read State Routes", () => {
  describe("PUT /channels/:channelId/ack", () => {
    it("creates a read state for a channel", async () => {
      const user = await createTestUser();
      const server = await createTestServer(user.id);
      const channel = await createTestChannel(server.id);

      // Send a message first
      const { body: msgBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: user.token,
        body: { content: "hello" },
      });

      const messageId = (msgBody.message as Record<string, unknown>).id as string;

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/ack`, {
        token: user.token,
        body: { messageId },
      });

      expect(status).toBe(204);
    });

    it("updates an existing read state", async () => {
      const user = await createTestUser();
      const server = await createTestServer(user.id);
      const channel = await createTestChannel(server.id);

      // Send two messages
      const { body: msg1Body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: user.token,
        body: { content: "first" },
      });
      const msg1Id = (msg1Body.message as Record<string, unknown>).id as string;

      const { body: msg2Body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: user.token,
        body: { content: "second" },
      });
      const msg2Id = (msg2Body.message as Record<string, unknown>).id as string;

      // ACK first message
      await apiRequest("PUT", `/channels/${channel.id}/ack`, {
        token: user.token,
        body: { messageId: msg1Id },
      });

      // ACK second message (update)
      const { status } = await apiRequest("PUT", `/channels/${channel.id}/ack`, {
        token: user.token,
        body: { messageId: msg2Id },
      });
      expect(status).toBe(204);

      // Verify the read state reflects the second message
      const { body: listBody } = await apiRequest("GET", "/read-states", {
        token: user.token,
      });

      const readStates = listBody.readStates as Record<string, unknown>[];
      const channelState = readStates.find((rs) => rs.channelId === channel.id);
      expect(channelState).toBeDefined();
      expect(channelState?.lastReadMessageId).toBe(msg2Id);
    });

    it("does not move read state backwards", async () => {
      const user = await createTestUser();
      const server = await createTestServer(user.id);
      const channel = await createTestChannel(server.id);

      const { body: msg1Body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: user.token,
        body: { content: "first" },
      });
      const msg1Id = (msg1Body.message as Record<string, unknown>).id as string;

      const { body: msg2Body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: user.token,
        body: { content: "second" },
      });
      const msg2Id = (msg2Body.message as Record<string, unknown>).id as string;

      await apiRequest("PUT", `/channels/${channel.id}/ack`, {
        token: user.token,
        body: { messageId: msg2Id },
      });

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/ack`, {
        token: user.token,
        body: { messageId: msg1Id },
      });
      expect(status).toBe(204);

      const { body: listBody } = await apiRequest("GET", "/read-states", {
        token: user.token,
      });
      const readStates = listBody.readStates as Record<string, unknown>[];
      const channelState = readStates.find((rs) => rs.channelId === channel.id);
      expect(channelState?.lastReadMessageId).toBe(msg2Id);
    });

    it("rejects ACK for channels the user is not a member of", async () => {
      const owner = await createTestUser();
      const outsider = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);

      const { body: msgBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: owner.token,
        body: { content: "hello" },
      });
      const messageId = (msgBody.message as Record<string, unknown>).id as string;

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/ack`, {
        token: outsider.token,
        body: { messageId },
      });
      expect(status).toBe(403);
    });

    it("rejects ACK when message does not belong to the channel", async () => {
      const user = await createTestUser();
      const server = await createTestServer(user.id);
      const channel1 = await createTestChannel(server.id);
      const channel2 = await createTestChannel(server.id);

      const { body: msgBody } = await apiRequest("POST", `/channels/${channel1.id}/messages`, {
        token: user.token,
        body: { content: "hello" },
      });
      const messageId = (msgBody.message as Record<string, unknown>).id as string;

      const { status } = await apiRequest("PUT", `/channels/${channel2.id}/ack`, {
        token: user.token,
        body: { messageId },
      });
      expect(status).toBe(400);
    });

    it("rejects without auth", async () => {
      const { status } = await apiRequest("PUT", "/channels/123/ack", {
        body: { messageId: "456" },
      });
      expect(status).toBe(401);
    });
  });

  describe("GET /read-states", () => {
    it("returns empty list when no read states exist", async () => {
      const user = await createTestUser();

      const { status, body } = await apiRequest("GET", "/read-states", {
        token: user.token,
      });

      expect(status).toBe(200);
      expect(body.readStates).toEqual([]);
    });

    it("returns read states for multiple channels", async () => {
      const user = await createTestUser();
      const server = await createTestServer(user.id);
      const channel1 = await createTestChannel(server.id);
      const channel2 = await createTestChannel(server.id);

      // Send messages to both channels
      const { body: msg1 } = await apiRequest("POST", `/channels/${channel1.id}/messages`, {
        token: user.token,
        body: { content: "hello ch1" },
      });
      const { body: msg2 } = await apiRequest("POST", `/channels/${channel2.id}/messages`, {
        token: user.token,
        body: { content: "hello ch2" },
      });

      const msg1Id = (msg1.message as Record<string, unknown>).id as string;
      const msg2Id = (msg2.message as Record<string, unknown>).id as string;

      // ACK both
      await apiRequest("PUT", `/channels/${channel1.id}/ack`, {
        token: user.token,
        body: { messageId: msg1Id },
      });
      await apiRequest("PUT", `/channels/${channel2.id}/ack`, {
        token: user.token,
        body: { messageId: msg2Id },
      });

      const { status, body } = await apiRequest("GET", "/read-states", {
        token: user.token,
      });

      expect(status).toBe(200);
      const readStates = body.readStates as Record<string, unknown>[];
      expect(readStates).toHaveLength(2);
    });

    it("only returns read states for the authenticated user", async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const server = await createTestServer(user1.id);
      const channel = await createTestChannel(server.id);

      const { body: msgBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: user1.token,
        body: { content: "hello" },
      });
      const messageId = (msgBody.message as Record<string, unknown>).id as string;

      // User 1 ACKs
      await apiRequest("PUT", `/channels/${channel.id}/ack`, {
        token: user1.token,
        body: { messageId },
      });

      // User 2 should see no read states
      const { body } = await apiRequest("GET", "/read-states", {
        token: user2.token,
      });
      expect((body.readStates as unknown[]).length).toBe(0);
    });
  });
});
