import { describe, expect, it } from "vitest";

import {
	createTestChannel,
	createTestDm,
	createTestServer,
	createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Message Routes", () => {
	describe("POST /channels/:channelId/messages", () => {
		it("sends a message to a server channel as member", async () => {
			const alice = await createTestUser({ username: "alice" });
			const server = await createTestServer(alice.id);
			const channel = await createTestChannel(server.id);

			const { status, body } = await apiRequest(
				"POST",
				`/channels/${channel.id}/messages`,
				{
					token: alice.token,
					body: { content: "Hello world!" },
				},
			);

			expect(status).toBe(201);
			const msg = body.message as Record<string, unknown>;
			expect(msg.content).toBe("Hello world!");
			expect((msg.author as Record<string, unknown>).username).toBe("alice");
		});

		it("sends a message to a DM channel as member", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });

			const dm = await createTestDm(alice.id, bob.id);

			const { status, body } = await apiRequest(
				"POST",
				`/channels/${dm.channelId}/messages`,
				{
					token: alice.token,
					body: { content: "Hey Bob!" },
				},
			);

			expect(status).toBe(201);
			expect((body.message as Record<string, unknown>).content).toBe("Hey Bob!");
		});

		it("rejects message to channel user is not in", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });
			const server = await createTestServer(alice.id);
			const channel = await createTestChannel(server.id);

			const { status } = await apiRequest(
				"POST",
				`/channels/${channel.id}/messages`,
				{
					token: bob.token,
					body: { content: "Sneaky!" },
				},
			);

			expect(status).toBe(403);
		});
	});

	describe("PATCH /messages/:id", () => {
		it("edits own message", async () => {
			const alice = await createTestUser({ username: "alice" });
			const server = await createTestServer(alice.id);
			const channel = await createTestChannel(server.id);

			const { body: created } = await apiRequest(
				"POST",
				`/channels/${channel.id}/messages`,
				{
					token: alice.token,
					body: { content: "Original" },
				},
			);

			const messageId = (created.message as Record<string, unknown>).id;

			const { status, body } = await apiRequest("PATCH", `/messages/${messageId}`, {
				token: alice.token,
				body: { content: "Edited" },
			});

			expect(status).toBe(200);
			expect((body.message as Record<string, unknown>).content).toBe("Edited");
			expect((body.message as Record<string, unknown>).editedAt).toBeDefined();
		});

		it("rejects editing another user's message", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });
			const server = await createTestServer(alice.id);
			const channel = await createTestChannel(server.id);

			const { body: created } = await apiRequest(
				"POST",
				`/channels/${channel.id}/messages`,
				{
					token: alice.token,
					body: { content: "Alice's message" },
				},
			);

			const messageId = (created.message as Record<string, unknown>).id;

			// Bob tries to edit Alice's message (Bob isn't even a server member, so 403)
			const { status } = await apiRequest("PATCH", `/messages/${messageId}`, {
				token: bob.token,
				body: { content: "Hacked!" },
			});

			expect(status).toBe(403);
		});
	});

	describe("DELETE /messages/:id", () => {
		it("deletes own message", async () => {
			const alice = await createTestUser({ username: "alice" });
			const server = await createTestServer(alice.id);
			const channel = await createTestChannel(server.id);

			const { body: created } = await apiRequest(
				"POST",
				`/channels/${channel.id}/messages`,
				{
					token: alice.token,
					body: { content: "Delete me" },
				},
			);

			const messageId = (created.message as Record<string, unknown>).id;

			const { status } = await apiRequest("DELETE", `/messages/${messageId}`, {
				token: alice.token,
			});

			expect(status).toBe(200);
		});
	});

	describe("GET /channels/:channelId/messages", () => {
		it("lists messages in a channel", async () => {
			const alice = await createTestUser({ username: "alice" });
			const server = await createTestServer(alice.id);
			const channel = await createTestChannel(server.id);

			await apiRequest("POST", `/channels/${channel.id}/messages`, {
				token: alice.token,
				body: { content: "First message" },
			});

			await apiRequest("POST", `/channels/${channel.id}/messages`, {
				token: alice.token,
				body: { content: "Second message" },
			});

			const { status, body } = await apiRequest(
				"GET",
				`/channels/${channel.id}/messages`,
				{ token: alice.token },
			);

			expect(status).toBe(200);
			const messages = body.messages as Array<Record<string, unknown>>;
			expect(messages).toHaveLength(2);
		});
	});
});
