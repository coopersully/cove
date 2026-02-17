import { db, serverMembers } from "@cove/db";
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Mention Routes", () => {
  describe("POST /channels/:channelId/messages (with mentions)", () => {
    it("includes mentioned user IDs in response", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: `Hello <@${bob.id}>!` },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      const mentions = msg.mentions as string[];
      expect(mentions).toContain(bob.id);
    });

    it("returns empty mentions for message without mentions", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "No mentions here" },
      });

      const msg = body.message as Record<string, unknown>;
      expect(msg.mentions).toEqual([]);
    });

    it("ignores mentions inside code blocks", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const { body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: `Check this code: \`<@${bob.id}>\`` },
      });

      const msg = body.message as Record<string, unknown>;
      expect(msg.mentions).toEqual([]);
    });

    it("deduplicates mentions in response", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const { body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: `<@${bob.id}> <@${bob.id}> <@${bob.id}>` },
      });

      const msg = body.message as Record<string, unknown>;
      const mentions = msg.mentions as string[];
      expect(mentions).toHaveLength(1);
      expect(mentions).toContain(bob.id);
    });
  });

  describe("GET /channels/:channelId/messages (with mentions)", () => {
    it("includes mentions in message list", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: `Hey <@${bob.id}>` },
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs[0];
      expect((msg!.mentions as string[])).toContain(bob.id);
    });
  });
});
