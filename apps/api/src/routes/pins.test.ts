import { db, messages, serverMembers } from "@cove/db";
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

describe("Pin Routes", () => {
  describe("PUT /channels/:channelId/pins/:messageId", () => {
    it("pins a message as server owner", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/pins/${message.id}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("rejects pin from member without MANAGE_MESSAGES", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      // Add bob as regular member
      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/pins/${message.id}`,
        { token: bob.token },
      );

      expect(status).toBe(403);
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

      const { status } = await apiRequest(
        "DELETE",
        `/channels/${channel.id}/pins/${message.id}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
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

      const { status, body } = await apiRequest(
        "GET",
        `/channels/${channel.id}/pins`,
        { token: alice.token },
      );

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(2);
    });

    it("returns empty array when nothing is pinned", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status, body } = await apiRequest(
        "GET",
        `/channels/${channel.id}/pins`,
        { token: alice.token },
      );

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(0);
    });
  });
});
