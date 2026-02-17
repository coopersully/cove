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
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin me!");

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      expect(status).toBe(204);
    });

    it("rejects pin from member without MANAGE_MESSAGES", async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin me!");

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(member.id),
      });

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: member.token,
      });

      expect(status).toBe(403);
    });

    it("pinning an already-pinned message is idempotent", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin me!");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      expect(status).toBe(204);

      // Verify it only appears once in the pins list
      const { body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: owner.token,
      });
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(1);
    });

    it("returns 404 for nonexistent message", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/pins/999999999999999999`,
        { token: owner.token },
      );

      expect(status).toBe(404);
    });

    it("rejects pin without authentication", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin me!");

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`);

      expect(status).toBe(401);
    });

    it("rejects pin from non-member", async () => {
      const owner = await createTestUser();
      const outsider = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin me!");

      const { status } = await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: outsider.token,
      });

      expect(status).toBe(403);
    });

    it("allows pinning in DM channels by either participant", async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const dm = await createTestDm(userA.id, userB.id);
      const message = await createTestMessage(dm.channelId, userA.id, "Pin this DM");

      const { status } = await apiRequest("PUT", `/channels/${dm.channelId}/pins/${message.id}`, {
        token: userB.token,
      });

      expect(status).toBe(204);
    });
  });

  describe("DELETE /channels/:channelId/pins/:messageId", () => {
    it("unpins a pinned message", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin me!");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      const { status } = await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      expect(status).toBe(204);

      // Verify it's removed from the pins list
      const { body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: owner.token,
      });
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(0);
    });

    it("unpinning a non-pinned message succeeds (idempotent)", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Not pinned");

      const { status } = await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      expect(status).toBe(204);
    });

    it("rejects unpin from member without MANAGE_MESSAGES", async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin me!");

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(member.id),
      });

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      const { status } = await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: member.token,
      });

      expect(status).toBe(403);
    });
  });

  describe("GET /channels/:channelId/pins", () => {
    it("lists pinned messages", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const msg1 = await createTestMessage(channel.id, owner.id, "First pinned");
      const msg2 = await createTestMessage(channel.id, owner.id, "Second pinned");
      await createTestMessage(channel.id, owner.id, "Not pinned");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${msg1.id}`, {
        token: owner.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/pins/${msg2.id}`, {
        token: owner.token,
      });

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: owner.token,
      });

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(2);
    });

    it("returns empty array when nothing is pinned", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: owner.token,
      });

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(0);
    });

    it("rejects pin listing from non-member", async () => {
      const owner = await createTestUser();
      const outsider = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: outsider.token,
      });

      expect(status).toBe(403);
    });

    it("includes author info and pinnedAt/pinnedBy in pin responses", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pinned with details");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/pins`, {
        token: owner.token,
      });
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(1);

      const pin = pins[0]!;
      expect(pin.id).toBe(message.id);
      expect(pin.content).toBe("Pinned with details");
      expect(pin.pinnedAt).toBeDefined();
      expect(pin.pinnedBy).toBe(owner.id);
      expect(pin.author).toBeDefined();
      const author = pin.author as Record<string, unknown>;
      expect(author.id).toBe(owner.id);
    });

    it("pinnedAt and pinnedBy appear in GET messages response", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin visible in messages");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: owner.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      expect(msg).toBeDefined();
      expect(msg!.pinnedAt).toBeDefined();
      expect(msg!.pinnedAt).not.toBeNull();
      expect(msg!.pinnedBy).toBe(owner.id);
    });

    it("unpinned messages have null pinnedAt/pinnedBy in GET messages response", async () => {
      const owner = await createTestUser();
      const server = await createTestServer(owner.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, owner.id, "Pin then unpin");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });
      await apiRequest("DELETE", `/channels/${channel.id}/pins/${message.id}`, {
        token: owner.token,
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: owner.token,
      });
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      expect(msg).toBeDefined();
      expect(msg!.pinnedAt).toBeNull();
      expect(msg!.pinnedBy).toBeNull();
    });
  });
});
