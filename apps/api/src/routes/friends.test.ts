import { describe, expect, it } from "vitest";

import { createTestFriendship, createTestUser } from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Friends Routes", () => {
	describe("POST /friends/requests", () => {
		it("sends a friend request", async () => {
			const alice = await createTestUser({ username: "alice" });
			await createTestUser({ username: "bob" });

			const { status, body } = await apiRequest("POST", "/friends/requests", {
				token: alice.token,
				body: { username: "bob" },
			});

			expect(status).toBe(201);
			const request = body.request as Record<string, unknown>;
			expect(request.status).toBe("pending");
			expect((request.user as Record<string, unknown>).username).toBe("bob");
		});

		it("rejects request to nonexistent user", async () => {
			const alice = await createTestUser({ username: "alice" });

			const { status } = await apiRequest("POST", "/friends/requests", {
				token: alice.token,
				body: { username: "nobody" },
			});

			expect(status).toBe(404);
		});

		it("rejects request to yourself", async () => {
			const alice = await createTestUser({ username: "alice" });

			const { status } = await apiRequest("POST", "/friends/requests", {
				token: alice.token,
				body: { username: "alice" },
			});

			expect(status).toBe(400);
		});

		it("rejects duplicate request", async () => {
			const alice = await createTestUser({ username: "alice" });
			await createTestUser({ username: "bob" });

			await apiRequest("POST", "/friends/requests", {
				token: alice.token,
				body: { username: "bob" },
			});

			const { status } = await apiRequest("POST", "/friends/requests", {
				token: alice.token,
				body: { username: "bob" },
			});

			expect(status).toBe(400);
		});
	});

	describe("POST /friends/requests/:requestId/accept", () => {
		it("accepts a friend request", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });

			const { body: reqBody } = await apiRequest("POST", "/friends/requests", {
				token: alice.token,
				body: { username: "bob" },
			});

			const requestId = (reqBody.request as Record<string, unknown>).id;

			const { status, body } = await apiRequest(
				"POST",
				`/friends/requests/${requestId}/accept`,
				{ token: bob.token },
			);

			expect(status).toBe(200);
			expect((body.request as Record<string, unknown>).status).toBe("accepted");
		});

		it("rejects accept from wrong user", async () => {
			const alice = await createTestUser({ username: "alice" });
			await createTestUser({ username: "bob" });

			const { body: reqBody } = await apiRequest("POST", "/friends/requests", {
				token: alice.token,
				body: { username: "bob" },
			});

			const requestId = (reqBody.request as Record<string, unknown>).id;

			// Alice (the requester) tries to accept her own request
			const { status } = await apiRequest(
				"POST",
				`/friends/requests/${requestId}/accept`,
				{ token: alice.token },
			);

			expect(status).toBe(403);
		});
	});

	describe("GET /friends", () => {
		it("lists friends for both users (catches BigInt comparison bug)", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });

			await createTestFriendship(alice.id, bob.id, "accepted");

			// Alice should see Bob
			const { status: aliceStatus, body: aliceBody } = await apiRequest("GET", "/friends", {
				token: alice.token,
			});

			expect(aliceStatus).toBe(200);
			const aliceFriends = aliceBody.friends as Array<Record<string, unknown>>;
			expect(aliceFriends).toHaveLength(1);
			expect(aliceFriends[0]!.username).toBe("bob");

			// Bob should see Alice
			const { status: bobStatus, body: bobBody } = await apiRequest("GET", "/friends", {
				token: bob.token,
			});

			expect(bobStatus).toBe(200);
			const bobFriends = bobBody.friends as Array<Record<string, unknown>>;
			expect(bobFriends).toHaveLength(1);
			expect(bobFriends[0]!.username).toBe("alice");
		});

		it("returns empty list when no friends", async () => {
			const alice = await createTestUser({ username: "alice" });

			const { status, body } = await apiRequest("GET", "/friends", {
				token: alice.token,
			});

			expect(status).toBe(200);
			expect(body.friends).toEqual([]);
		});
	});

	describe("GET /friends/requests/incoming", () => {
		it("lists incoming pending requests", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });

			await createTestFriendship(alice.id, bob.id, "pending");

			const { status, body } = await apiRequest("GET", "/friends/requests/incoming", {
				token: bob.token,
			});

			expect(status).toBe(200);
			const requests = body.requests as Array<Record<string, unknown>>;
			expect(requests).toHaveLength(1);
			expect((requests[0]!.user as Record<string, unknown>).username).toBe("alice");
		});
	});

	describe("GET /friends/requests/outgoing", () => {
		it("lists outgoing pending requests", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });

			await createTestFriendship(alice.id, bob.id, "pending");

			const { status, body } = await apiRequest("GET", "/friends/requests/outgoing", {
				token: alice.token,
			});

			expect(status).toBe(200);
			const requests = body.requests as Array<Record<string, unknown>>;
			expect(requests).toHaveLength(1);
			expect((requests[0]!.user as Record<string, unknown>).username).toBe("bob");
		});
	});

	describe("DELETE /friends/requests/:requestId", () => {
		it("declines a pending request", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });

			const friendship = await createTestFriendship(alice.id, bob.id, "pending");

			const { status } = await apiRequest("DELETE", `/friends/requests/${friendship.id}`, {
				token: bob.token,
			});

			expect(status).toBe(204);

			// Verify it's gone
			const { body } = await apiRequest("GET", "/friends/requests/incoming", {
				token: bob.token,
			});
			expect(body.requests).toEqual([]);
		});
	});

	describe("DELETE /friends/:userId", () => {
		it("removes a friend", async () => {
			const alice = await createTestUser({ username: "alice" });
			const bob = await createTestUser({ username: "bob" });

			await createTestFriendship(alice.id, bob.id, "accepted");

			const { status } = await apiRequest("DELETE", `/friends/${bob.id}`, {
				token: alice.token,
			});

			expect(status).toBe(204);

			// Verify friend list is now empty
			const { body } = await apiRequest("GET", "/friends", {
				token: alice.token,
			});
			expect(body.friends).toEqual([]);
		});
	});
});
