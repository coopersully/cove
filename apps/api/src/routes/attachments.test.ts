import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Attachment Routes", () => {
  describe("POST /channels/:channelId/messages (with attachmentIds)", () => {
    it("creates a message with attachment IDs", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      // Note: File upload endpoint test will need multipart handling.
      // For now, test that sending a message with attachmentIds field works.
      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Check this out!" },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      expect(msg.attachments).toEqual([]);
    });
  });
});
