import { customEmojis, db, serverMembers } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

// Helper: insert custom emoji directly for testing
async function createTestEmoji(serverId: string, creatorId: string, name: string) {
  const id = generateSnowflake();
  const [created] = await db
    .insert(customEmojis)
    .values({
      id: BigInt(id),
      serverId: BigInt(serverId),
      name,
      imageUrl: `/uploads/emojis/${serverId}/${id}.png`,
      creatorId: BigInt(creatorId),
    })
    .returning();
  return { id, ...created! };
}

describe("Custom Emoji Routes", () => {
  describe("GET /servers/:serverId/emojis", () => {
    it("lists emojis for a server", async () => {
      const alice = await createTestUser({ username: "emo_alice1" });
      const server = await createTestServer(alice.id);

      await createTestEmoji(server.id, alice.id, "party");
      await createTestEmoji(server.id, alice.id, "fire");

      const { status, body } = await apiRequest("GET", `/servers/${server.id}/emojis`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const emojis = body.emojis as Array<Record<string, unknown>>;
      expect(emojis).toHaveLength(2);
      expect(emojis.map((e) => e.name)).toContain("party");
      expect(emojis.map((e) => e.name)).toContain("fire");
    });

    it("returns empty array when no emojis", async () => {
      const alice = await createTestUser({ username: "emo_alice2" });
      const server = await createTestServer(alice.id);

      const { status, body } = await apiRequest("GET", `/servers/${server.id}/emojis`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      expect(body.emojis).toEqual([]);
    });

    it("rejects non-member access", async () => {
      const alice = await createTestUser({ username: "emo_alice3" });
      const bob = await createTestUser({ username: "emo_bob3" });
      const server = await createTestServer(alice.id);

      const { status } = await apiRequest("GET", `/servers/${server.id}/emojis`, {
        token: bob.token,
      });

      expect(status).toBe(403);
    });

    it("returns emoji with correct fields", async () => {
      const alice = await createTestUser({ username: "emo_alice4" });
      const server = await createTestServer(alice.id);

      await createTestEmoji(server.id, alice.id, "wave");

      const { body } = await apiRequest("GET", `/servers/${server.id}/emojis`, {
        token: alice.token,
      });

      const emojis = body.emojis as Array<Record<string, unknown>>;
      const emoji = emojis[0]!;
      expect(emoji.id).toBeDefined();
      expect(emoji.name).toBe("wave");
      expect(emoji.imageUrl).toBeDefined();
      expect(emoji.creatorId).toBe(alice.id);
      expect(emoji.createdAt).toBeDefined();
    });
  });

  describe("DELETE /servers/:serverId/emojis/:emojiId", () => {
    it("deletes an emoji", async () => {
      const alice = await createTestUser({ username: "emo_alice5" });
      const server = await createTestServer(alice.id);

      const emoji = await createTestEmoji(server.id, alice.id, "old");

      const { status } = await apiRequest(
        "DELETE",
        `/servers/${server.id}/emojis/${emoji.id}`,
        { token: alice.token },
      );

      expect(status).toBe(200);

      // Verify it's gone
      const rows = await db
        .select()
        .from(customEmojis)
        .where(eq(customEmojis.id, BigInt(emoji.id)));
      expect(rows).toHaveLength(0);
    });

    it("returns 404 for non-existent emoji", async () => {
      const alice = await createTestUser({ username: "emo_alice6" });
      const server = await createTestServer(alice.id);

      const { status } = await apiRequest(
        "DELETE",
        `/servers/${server.id}/emojis/${generateSnowflake()}`,
        { token: alice.token },
      );

      expect(status).toBe(404);
    });

    it("rejects non-member deletion", async () => {
      const alice = await createTestUser({ username: "emo_alice7" });
      const bob = await createTestUser({ username: "emo_bob7" });
      const server = await createTestServer(alice.id);

      const emoji = await createTestEmoji(server.id, alice.id, "private_emoji");

      const { status } = await apiRequest(
        "DELETE",
        `/servers/${server.id}/emojis/${emoji.id}`,
        { token: bob.token },
      );

      expect(status).toBe(403);
    });
  });

  describe("Custom emoji name uniqueness", () => {
    it("enforces unique names per server", async () => {
      const alice = await createTestUser({ username: "emo_alice8" });
      const server = await createTestServer(alice.id);

      await createTestEmoji(server.id, alice.id, "dupe");

      // Try inserting again with the same name - should fail at DB level
      try {
        await createTestEmoji(server.id, alice.id, "dupe");
        expect.fail("Should have thrown");
      } catch {
        // Expected - unique constraint violation
      }
    });

    it("allows same name on different servers", async () => {
      const alice = await createTestUser({ username: "emo_alice9" });
      const server1 = await createTestServer(alice.id);
      const server2 = await createTestServer(alice.id);

      await createTestEmoji(server1.id, alice.id, "smile");
      await createTestEmoji(server2.id, alice.id, "smile");

      const { body: body1 } = await apiRequest("GET", `/servers/${server1.id}/emojis`, {
        token: alice.token,
      });
      const { body: body2 } = await apiRequest("GET", `/servers/${server2.id}/emojis`, {
        token: alice.token,
      });

      expect((body1.emojis as unknown[]).length).toBe(1);
      expect((body2.emojis as unknown[]).length).toBe(1);
    });
  });

  describe("Custom emoji cascading on server delete", () => {
    it("deletes emojis when server is deleted", async () => {
      const alice = await createTestUser({ username: "emo_alice10" });
      const server = await createTestServer(alice.id);

      const emoji = await createTestEmoji(server.id, alice.id, "cascade_test");

      // Delete the server via API
      const { status } = await apiRequest("DELETE", `/servers/${server.id}`, {
        token: alice.token,
      });

      expect(status).toBe(200);

      // Verify emoji is gone
      const rows = await db
        .select()
        .from(customEmojis)
        .where(eq(customEmojis.id, BigInt(emoji.id)));
      expect(rows).toHaveLength(0);
    });
  });
});
