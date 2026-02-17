import { describe, expect, it } from "vitest";

import { generatePasswordResetToken } from "@cove/auth";
import { sql } from "drizzle-orm";

import { createTestInviteCode } from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Register a user through the API and return their token + id */
async function registerUser(username: string) {
  const { status, body } = await apiRequest("POST", "/auth/register", {
    body: { username, email: `${username}@test.com`, password: "Password1" },
  });
  expect(status).toBe(201);
  return {
    id: (body.user as Record<string, unknown>).id as string,
    username,
    token: body.accessToken as string,
    refreshToken: body.refreshToken as string,
  };
}

/** Send friend request and accept it, all through the API */
async function makeFriends(
  sender: { token: string },
  receiverUsername: string,
  receiver: { token: string },
) {
  const { body: reqBody } = await apiRequest("POST", "/friends/requests", {
    token: sender.token,
    body: { username: receiverUsername },
  });
  const requestId = (reqBody.request as Record<string, unknown>).id as string;

  await apiRequest("POST", `/friends/requests/${requestId}/accept`, {
    token: receiver.token,
  });

  return requestId;
}

// ── Auth Journey ────────────────────────────────────────────────────────────

describe("E2E: Auth", () => {
  it("register → login → refresh → access protected route", async () => {
    // Register
    const { body: regBody } = await apiRequest("POST", "/auth/register", {
      body: { username: "carol", email: "carol@test.com", password: "Password1" },
    });
    expect(regBody.accessToken).toBeDefined();
    const refreshToken = regBody.refreshToken as string;

    // Login with same credentials
    const { status: loginStatus, body: loginBody } = await apiRequest("POST", "/auth/login", {
      body: { email: "carol@test.com", password: "Password1" },
    });
    expect(loginStatus).toBe(200);
    const loginToken = loginBody.accessToken as string;

    // Use login token on a protected route
    const { status: meStatus, body: meBody } = await apiRequest("GET", "/users/me", {
      token: loginToken,
    });
    expect(meStatus).toBe(200);
    expect((meBody.user as Record<string, unknown>).username).toBe("carol");

    // Rotate refresh token from registration
    const { status: refreshStatus, body: refreshBody } = await apiRequest("POST", "/auth/refresh", {
      body: { refreshToken },
    });
    expect(refreshStatus).toBe(200);
    expect(refreshBody.refreshToken).not.toBe(refreshToken);

    // Use new access token from refresh
    const newToken = refreshBody.accessToken as string;
    const { status: meStatus2 } = await apiRequest("GET", "/users/me", { token: newToken });
    expect(meStatus2).toBe(200);

    // Old refresh token is now revoked
    const { status: reuseStatus } = await apiRequest("POST", "/auth/refresh", {
      body: { refreshToken },
    });
    expect(reuseStatus).toBe(401);
  });

  it("register with duplicate email → 409", async () => {
    await registerUser("alice");

    const { status, body } = await apiRequest("POST", "/auth/register", {
      body: { username: "alice2", email: "alice@test.com", password: "Password1" },
    });
    expect(status).toBe(409);
    expect((body.error as Record<string, unknown>).message).toContain("Email");
  });

  it("login with wrong password → 401", async () => {
    await registerUser("carol");

    const { status } = await apiRequest("POST", "/auth/login", {
      body: { email: "carol@test.com", password: "WrongPassword1" },
    });
    expect(status).toBe(401);
  });

  it("login with non-existent email → 401", async () => {
    const { status } = await apiRequest("POST", "/auth/login", {
      body: { email: "nobody@test.com", password: "Password1" },
    });
    expect(status).toBe(401);
  });

  it("protected route without token → 401", async () => {
    const { status } = await apiRequest("GET", "/users/me");
    expect(status).toBe(401);
  });

  it("password reset: forgot → validate → reset → login with new password", async () => {
    const alice = await registerUser("alice");

    // Forgot password always returns success (even for non-existent emails)
    const { status: forgotStatus } = await apiRequest("POST", "/auth/forgot-password", {
      body: { email: "nobody@test.com" },
    });
    expect(forgotStatus).toBe(200);

    // Generate a real reset token directly (skipping email delivery)
    const resetToken = await generatePasswordResetToken(alice.id);

    // Validate the token
    const { body: validateBody } = await apiRequest("POST", "/auth/validate-reset-token", {
      body: { token: resetToken },
    });
    expect(validateBody.valid).toBe(true);

    // Reset password
    const { status: resetStatus } = await apiRequest("POST", "/auth/reset-password", {
      body: { token: resetToken, password: "NewPassword1" },
    });
    expect(resetStatus).toBe(200);

    // Old password no longer works
    const { status: oldLogin } = await apiRequest("POST", "/auth/login", {
      body: { email: "alice@test.com", password: "Password1" },
    });
    expect(oldLogin).toBe(401);

    // New password works
    const { status: newLogin } = await apiRequest("POST", "/auth/login", {
      body: { email: "alice@test.com", password: "NewPassword1" },
    });
    expect(newLogin).toBe(200);

    // Token is consumed — cannot reuse
    const { body: revalidate } = await apiRequest("POST", "/auth/validate-reset-token", {
      body: { token: resetToken },
    });
    expect(revalidate.valid).toBe(false);
  });

  it("check username availability", async () => {
    await registerUser("taken_name");

    const { status: takenStatus, body: takenBody } = await apiRequest(
      "GET",
      "/auth/check-availability",
      { query: { username: "taken_name" } },
    );
    expect(takenStatus).toBe(200);
    expect(takenBody.available).toBe(false);

    const { status: freeStatus, body: freeBody } = await apiRequest(
      "GET",
      "/auth/check-availability",
      { query: { username: "free_name" } },
    );
    expect(freeStatus).toBe(200);
    expect(freeBody.available).toBe(true);
  });

  it("check availability rejects missing or malformed username query", async () => {
    const { status: missingStatus } = await apiRequest("GET", "/auth/check-availability");
    expect(missingStatus).toBe(400);

    const { status: malformedStatus } = await apiRequest("GET", "/auth/check-availability", {
      query: { username: "bad-name!" },
    });
    expect(malformedStatus).toBe(400);
  });

  it("password reset revokes all existing refresh tokens", async () => {
    const alice = await registerUser("alice");
    const initialRefreshToken = alice.refreshToken;

    const { status: loginStatus, body: loginBody } = await apiRequest("POST", "/auth/login", {
      body: { email: "alice@test.com", password: "Password1" },
    });
    expect(loginStatus).toBe(200);
    const secondRefreshToken = loginBody.refreshToken as string;

    const resetToken = await generatePasswordResetToken(alice.id);
    const { status: resetStatus } = await apiRequest("POST", "/auth/reset-password", {
      body: { token: resetToken, password: "EvenNewer1" },
    });
    expect(resetStatus).toBe(200);

    const { status: refreshInitialStatus } = await apiRequest("POST", "/auth/refresh", {
      body: { refreshToken: initialRefreshToken },
    });
    expect(refreshInitialStatus).toBe(401);

    const { status: refreshSecondStatus } = await apiRequest("POST", "/auth/refresh", {
      body: { refreshToken: secondRefreshToken },
    });
    expect(refreshSecondStatus).toBe(401);

    const { status: reloginStatus } = await apiRequest("POST", "/auth/login", {
      body: { email: "alice@test.com", password: "EvenNewer1" },
    });
    expect(reloginStatus).toBe(200);
  });
});

// ── User Profile Journey ────────────────────────────────────────────────────

describe("E2E: User Profile", () => {
  it("register → update profile → other user sees changes via search and profile", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    // Alice updates her profile
    const { status: updateStatus, body: updateBody } = await apiRequest("PATCH", "/users/me", {
      token: alice.token,
      body: { displayName: "Alice W", bio: "Hello world", pronouns: "she/her" },
    });
    expect(updateStatus).toBe(200);
    expect((updateBody.user as Record<string, unknown>).displayName).toBe("Alice W");

    // Bob searches for Alice
    const { body: searchBody } = await apiRequest("GET", "/users/search", {
      token: bob.token,
      query: { q: "alice" },
    });
    const results = searchBody.users as Record<string, unknown>[];
    expect(results).toHaveLength(1);
    expect(results[0]?.username).toBe("alice");
    expect(results[0]?.displayName).toBe("Alice W");

    // Bob views Alice's profile by ID
    const { status: profileStatus, body: profileBody } = await apiRequest(
      "GET",
      `/users/${alice.id}`,
      { token: bob.token },
    );
    expect(profileStatus).toBe(200);
    expect((profileBody.user as Record<string, unknown>).bio).toBe("Hello world");
    expect((profileBody.user as Record<string, unknown>).pronouns).toBe("she/her");
  });

  it("profile fields can be cleared with null values", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await apiRequest("PATCH", "/users/me", {
      token: alice.token,
      body: {
        displayName: "Alice Updated",
        bio: "Temp bio",
        pronouns: "she/her",
        status: "In a test",
        statusEmoji: ":wave:",
      },
    });

    const { status: clearStatus } = await apiRequest("PATCH", "/users/me", {
      token: alice.token,
      body: {
        displayName: null,
        bio: null,
        pronouns: null,
        status: null,
        statusEmoji: null,
      },
    });
    expect(clearStatus).toBe(200);

    const { status: profileStatus, body: profileBody } = await apiRequest(
      "GET",
      `/users/${alice.id}`,
      { token: bob.token },
    );
    expect(profileStatus).toBe(200);

    const user = profileBody.user as Record<string, unknown>;
    expect(user.displayName).toBeNull();
    expect(user.bio).toBeNull();
    expect(user.pronouns).toBeNull();
    expect(user.status).toBeNull();
    expect(user.statusEmoji).toBeNull();
  });
});

// ── Friend Request Journey ──────────────────────────────────────────────────

describe("E2E: Friend Requests", () => {
  it("send → accept → both see friend → remove → both empty", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    // Send request
    const { body: reqBody } = await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "bob" },
    });
    const requestId = (reqBody.request as Record<string, unknown>).id as string;

    // Bob sees incoming, Alice sees outgoing
    const { body: inBody } = await apiRequest("GET", "/friends/requests/incoming", {
      token: bob.token,
    });
    expect(inBody.requests as unknown[]).toHaveLength(1);

    const { body: outBody } = await apiRequest("GET", "/friends/requests/outgoing", {
      token: alice.token,
    });
    expect(outBody.requests as unknown[]).toHaveLength(1);

    // Accept
    await apiRequest("POST", `/friends/requests/${requestId}/accept`, { token: bob.token });

    // Both see each other
    const { body: aliceFriends } = await apiRequest("GET", "/friends", { token: alice.token });
    expect(aliceFriends.friends as unknown[]).toHaveLength(1);
    expect((aliceFriends.friends as Record<string, unknown>[])[0]?.username).toBe("bob");

    const { body: bobFriends } = await apiRequest("GET", "/friends", { token: bob.token });
    expect(bobFriends.friends as unknown[]).toHaveLength(1);
    expect((bobFriends.friends as Record<string, unknown>[])[0]?.username).toBe("alice");

    // Pending requests are now empty
    const { body: inAfter } = await apiRequest("GET", "/friends/requests/incoming", {
      token: bob.token,
    });
    expect(inAfter.requests).toEqual([]);

    // Remove friend
    await apiRequest("DELETE", `/friends/${bob.id}`, { token: alice.token });

    // Both friend lists are empty
    const { body: aliceEmpty } = await apiRequest("GET", "/friends", { token: alice.token });
    expect(aliceEmpty.friends).toEqual([]);
    const { body: bobEmpty } = await apiRequest("GET", "/friends", { token: bob.token });
    expect(bobEmpty.friends).toEqual([]);
  });

  it("send → decline → both lists empty", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: reqBody } = await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "bob" },
    });
    const requestId = (reqBody.request as Record<string, unknown>).id as string;

    // Bob declines
    const { status } = await apiRequest("DELETE", `/friends/requests/${requestId}`, {
      token: bob.token,
    });
    expect(status).toBe(204);

    // Alice's outgoing is empty, Bob's incoming is empty
    const { body: outBody } = await apiRequest("GET", "/friends/requests/outgoing", {
      token: alice.token,
    });
    expect(outBody.requests).toEqual([]);

    const { body: inBody } = await apiRequest("GET", "/friends/requests/incoming", {
      token: bob.token,
    });
    expect(inBody.requests).toEqual([]);

    // Neither has friends
    const { body: aliceFriends } = await apiRequest("GET", "/friends", { token: alice.token });
    expect(aliceFriends.friends).toEqual([]);
  });

  it("cannot send friend request to yourself", async () => {
    const alice = await registerUser("alice");

    const { status } = await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "alice" },
    });
    expect(status).toBe(400);
  });

  it("cannot send friend request to nonexistent user", async () => {
    const alice = await registerUser("alice");

    const { status } = await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "ghost_user" },
    });
    expect(status).toBe(404);
  });

  it("cannot send duplicate friend request", async () => {
    const alice = await registerUser("alice");
    await registerUser("bob");

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

  it("send → cancel (by sender) → lists empty", async () => {
    const alice = await registerUser("alice");
    await registerUser("bob");

    const { body: reqBody } = await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "bob" },
    });
    const requestId = (reqBody.request as Record<string, unknown>).id as string;

    // Alice cancels her own request
    const { status } = await apiRequest("DELETE", `/friends/requests/${requestId}`, {
      token: alice.token,
    });
    expect(status).toBe(204);

    const { body: outBody } = await apiRequest("GET", "/friends/requests/outgoing", {
      token: alice.token,
    });
    expect(outBody.requests).toEqual([]);
  });

  it("third-party user cannot accept or cancel someone else's request", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const charlie = await registerUser("charlie");

    const { body: reqBody } = await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "bob" },
    });
    const requestId = (reqBody.request as Record<string, unknown>).id as string;

    const { status: acceptStatus } = await apiRequest(
      "POST",
      `/friends/requests/${requestId}/accept`,
      { token: charlie.token },
    );
    expect(acceptStatus).toBe(403);

    const { status: cancelStatus } = await apiRequest("DELETE", `/friends/requests/${requestId}`, {
      token: charlie.token,
    });
    expect(cancelStatus).toBe(403);

    const { body: bobIncoming } = await apiRequest("GET", "/friends/requests/incoming", {
      token: bob.token,
    });
    expect(bobIncoming.requests as unknown[]).toHaveLength(1);
  });

  it("reciprocal friend request is blocked while one is pending", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "bob" },
    });

    const { status } = await apiRequest("POST", "/friends/requests", {
      token: bob.token,
      body: { username: "alice" },
    });
    expect(status).toBe(400);
  });
});

// ── DM Journey ──────────────────────────────────────────────────────────────

describe("E2E: DMs", () => {
  it("befriend → create DM → exchange messages → both read conversation", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    // Create DM
    const { status: dmStatus, body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    expect(dmStatus).toBe(201);
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    // Both see the DM in their lists
    const { body: aliceDms } = await apiRequest("GET", "/dms", { token: alice.token });
    expect(aliceDms.channels as unknown[]).toHaveLength(1);
    expect(
      ((aliceDms.channels as Record<string, unknown>[])[0]?.recipient as Record<string, unknown>)
        .username,
    ).toBe("bob");

    const { body: bobDms } = await apiRequest("GET", "/dms", { token: bob.token });
    expect(bobDms.channels as unknown[]).toHaveLength(1);
    expect(
      ((bobDms.channels as Record<string, unknown>[])[0]?.recipient as Record<string, unknown>)
        .username,
    ).toBe("alice");

    // Exchange messages
    await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Hey Bob!" },
    });
    await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: bob.token,
      body: { content: "Hey Alice!" },
    });

    // Both read conversation
    const { body: aliceMsgs } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    expect(aliceMsgs.messages as unknown[]).toHaveLength(2);

    const { body: bobMsgs } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: bob.token,
    });
    expect(bobMsgs.messages as unknown[]).toHaveLength(2);
  });

  it("GET /dms/:channelId returns channel + members for DM participants", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const charlie = await registerUser("charlie");

    await makeFriends(alice, "bob", bob);

    const { body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    const { status: getStatus, body: getBody } = await apiRequest("GET", `/dms/${channelId}`, {
      token: alice.token,
    });
    expect(getStatus).toBe(200);
    expect((getBody.channel as Record<string, unknown>).id).toBe(channelId);

    const members = getBody.members as Record<string, unknown>[];
    expect(members).toHaveLength(2);
    expect(members.some((member) => member.username === "alice")).toBe(true);
    expect(members.some((member) => member.username === "bob")).toBe(true);

    const { status: forbiddenStatus } = await apiRequest("GET", `/dms/${channelId}`, {
      token: charlie.token,
    });
    expect(forbiddenStatus).toBe(403);
  });

  it("DM channels cannot be modified via server channel management endpoints", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    const { body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    const { status: patchStatus } = await apiRequest("PATCH", `/channels/${channelId}`, {
      token: alice.token,
      body: { name: "not-allowed" },
    });
    expect(patchStatus).toBe(403);

    const { status: deleteStatus } = await apiRequest("DELETE", `/channels/${channelId}`, {
      token: alice.token,
    });
    expect(deleteStatus).toBe(403);
  });

  it("cannot DM before accepting friend request", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    // Send request but DON'T accept
    await apiRequest("POST", "/friends/requests", {
      token: alice.token,
      body: { username: "bob" },
    });

    const { status } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    expect(status).toBe(403);
  });

  it("DM dedup: both users get same channel", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    // Alice creates DM
    const { body: aliceDm } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const aliceChannelId = (aliceDm.channel as Record<string, unknown>).id;

    // Bob creates DM with Alice — same channel
    const { status, body: bobDm } = await apiRequest("POST", "/dms", {
      token: bob.token,
      body: { recipientId: alice.id },
    });
    expect(status).toBe(200);
    expect((bobDm.channel as Record<string, unknown>).id).toBe(aliceChannelId);
  });

  it("cannot DM yourself", async () => {
    const alice = await registerUser("alice");

    const { status } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: alice.id },
    });
    expect(status).toBe(400);
  });

  it("unfriend preserves DM history but blocks new DMs", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    // Create DM and send message
    const { body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Before unfriend" },
    });

    // Remove friend
    await apiRequest("DELETE", `/friends/${bob.id}`, { token: alice.token });

    // Existing messages still readable
    const { status: readStatus, body: msgsBody } = await apiRequest(
      "GET",
      `/channels/${channelId}/messages`,
      { token: alice.token },
    );
    expect(readStatus).toBe(200);
    expect((msgsBody.messages as unknown[]).length).toBe(1);

    // Cannot create a new DM
    const { status: newDmStatus } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    expect(newDmStatus).toBe(403);
  });
});

// ── Server Journey ──────────────────────────────────────────────────────────

describe("E2E: Servers", () => {
  it("create server → comes with #general → list servers → update → delete", async () => {
    const alice = await registerUser("alice");

    // Create server
    const { status: createStatus, body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Alice's Server", description: "A test server" },
    });
    expect(createStatus).toBe(201);
    const server = createBody.server as Record<string, unknown>;
    const serverId = server.id as string;
    expect(server.name).toBe("Alice's Server");
    expect(server.ownerId).toBe(alice.id);

    // Server has a default #general channel
    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const chans = channelsBody.channels as Record<string, unknown>[];
    expect(chans).toHaveLength(1);
    expect(chans[0]?.name).toBe("general");

    // Server appears in user's server list
    const { body: listBody } = await apiRequest("GET", "/servers", { token: alice.token });
    const serverList = listBody.servers as Record<string, unknown>[];
    expect(serverList).toHaveLength(1);
    expect(serverList[0]?.name).toBe("Alice's Server");

    // Update server
    const { status: updateStatus, body: updateBody } = await apiRequest(
      "PATCH",
      `/servers/${serverId}`,
      {
        token: alice.token,
        body: { name: "Renamed Server", description: "Updated" },
      },
    );
    expect(updateStatus).toBe(200);
    expect((updateBody.server as Record<string, unknown>).name).toBe("Renamed Server");

    // Get server by ID
    const { status: getStatus, body: getBody } = await apiRequest("GET", `/servers/${serverId}`, {
      token: alice.token,
    });
    expect(getStatus).toBe(200);
    expect((getBody.server as Record<string, unknown>).name).toBe("Renamed Server");

    // Delete server
    const { status: deleteStatus } = await apiRequest("DELETE", `/servers/${serverId}`, {
      token: alice.token,
    });
    expect(deleteStatus).toBe(200);

    // Server list is empty
    const { body: emptyList } = await apiRequest("GET", "/servers", { token: alice.token });
    expect(emptyList.servers).toEqual([]);
  });

  it("join public server → message in channel → leave server → cannot message", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    // Alice creates a public server
    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Public Hub", isPublic: true },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    // Get the default #general channel
    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const generalId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Bob joins the public server
    const { status: joinStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: {},
    });
    expect(joinStatus).toBe(201);

    // Bob sees the server in his list
    const { body: bobServers } = await apiRequest("GET", "/servers", { token: bob.token });
    expect(bobServers.servers as unknown[]).toHaveLength(1);

    // Bob can send a message in #general
    const { status: msgStatus } = await apiRequest("POST", `/channels/${generalId}/messages`, {
      token: bob.token,
      body: { content: "Hello everyone!" },
    });
    expect(msgStatus).toBe(201);

    // Alice can read Bob's message
    const { body: msgsBody } = await apiRequest("GET", `/channels/${generalId}/messages`, {
      token: alice.token,
    });
    const msgs = msgsBody.messages as Record<string, unknown>[];
    expect(msgs.some((m) => m.content === "Hello everyone!")).toBe(true);

    // Bob leaves
    const { status: leaveStatus } = await apiRequest("POST", `/servers/${serverId}/leave`, {
      token: bob.token,
    });
    expect(leaveStatus).toBe(200);

    // Bob can no longer send messages
    const { status: blockedMsg } = await apiRequest("POST", `/channels/${generalId}/messages`, {
      token: bob.token,
      body: { content: "Should fail" },
    });
    expect(blockedMsg).toBe(403);

    // Bob's server list is empty
    const { body: bobEmptyServers } = await apiRequest("GET", "/servers", { token: bob.token });
    expect(bobEmptyServers.servers).toEqual([]);
  });

  it("non-member cannot access private server", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Private Server" },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    // Bob cannot view private server
    const { status: viewStatus } = await apiRequest("GET", `/servers/${serverId}`, {
      token: bob.token,
    });
    expect(viewStatus).toBe(403);

    // Bob cannot join without invite
    const { status: joinStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: {},
    });
    expect(joinStatus).toBe(403);
  });

  it("non-owner cannot update or delete server", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Alice's Server", isPublic: true },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    // Bob joins
    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    // Bob cannot update
    const { status: updateStatus } = await apiRequest("PATCH", `/servers/${serverId}`, {
      token: bob.token,
      body: { name: "Hacked" },
    });
    expect(updateStatus).toBe(403);

    // Bob cannot delete
    const { status: deleteStatus } = await apiRequest("DELETE", `/servers/${serverId}`, {
      token: bob.token,
    });
    expect(deleteStatus).toBe(403);
  });

  it("join private server with invite code", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Private Club" },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    // Create invite code directly in DB
    const { code } = await createTestInviteCode(serverId, alice.id);

    // Bob joins with invite code
    const { status: joinStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: { inviteCode: code },
    });
    expect(joinStatus).toBe(201);

    // Bob can see the server
    const { body: bobServers } = await apiRequest("GET", "/servers", { token: bob.token });
    expect(bobServers.servers as unknown[]).toHaveLength(1);
  });

  it("reject private server join with invalid/expired/maxed invite code", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const charlie = await registerUser("charlie");

    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Exclusive Club" },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    // No invite code at all
    const { status: noCodeStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: {},
    });
    expect(noCodeStatus).toBe(403);

    // Wrong invite code
    const { status: wrongCodeStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: { inviteCode: "nonexistent" },
    });
    expect(wrongCodeStatus).toBe(403);

    // Expired invite code
    const { code: expiredCode } = await createTestInviteCode(serverId, alice.id, {
      expiresAt: new Date(Date.now() - 60_000), // expired 1 minute ago
    });
    const { status: expiredStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: { inviteCode: expiredCode },
    });
    expect(expiredStatus).toBe(403);

    // Maxed-out invite code (max 1 use)
    const { code: maxedCode } = await createTestInviteCode(serverId, alice.id, { maxUses: 1 });
    // Bob uses it
    await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: { inviteCode: maxedCode },
    });
    // Charlie can't use it — it's used up
    const { status: maxedStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: charlie.token,
      body: { inviteCode: maxedCode },
    });
    expect(maxedStatus).toBe(403);
  });

  it("owner cannot leave their own server", async () => {
    const alice = await registerUser("alice");

    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Alice's Server" },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    const { status } = await apiRequest("POST", `/servers/${serverId}/leave`, {
      token: alice.token,
    });
    expect(status).toBe(403);
  });

  it("public servers are discoverable, but non-members cannot list channels until they join", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Open Server", isPublic: true },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    const { status: discoverStatus } = await apiRequest("GET", `/servers/${serverId}`, {
      token: bob.token,
    });
    expect(discoverStatus).toBe(200);

    const { status: channelsBeforeJoin } = await apiRequest(
      "GET",
      `/servers/${serverId}/channels`,
      {
        token: bob.token,
      },
    );
    expect(channelsBeforeJoin).toBe(403);

    const { status: joinStatus } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: {},
    });
    expect(joinStatus).toBe(201);

    const { status: channelsAfterJoin, body: channelsBody } = await apiRequest(
      "GET",
      `/servers/${serverId}/channels`,
      { token: bob.token },
    );
    expect(channelsAfterJoin).toBe(200);
    expect(channelsBody.channels as unknown[]).toHaveLength(1);
  });

  it("joining or leaving unknown membership/server states returns correct errors", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: createBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Membership Edge", isPublic: true },
    });
    const serverId = (createBody.server as Record<string, unknown>).id as string;

    const { status: leaveNotMember } = await apiRequest("POST", `/servers/${serverId}/leave`, {
      token: bob.token,
    });
    expect(leaveNotMember).toBe(404);

    const { status: joinMissing } = await apiRequest("POST", "/servers/999999999999999999/join", {
      token: bob.token,
      body: {},
    });
    expect(joinMissing).toBe(404);
  });
});

// ── Channel Journey ─────────────────────────────────────────────────────────

describe("E2E: Channels", () => {
  it("create channel → update → list → delete", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Test Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    // Create a new channel
    const { status: createStatus, body: createBody } = await apiRequest(
      "POST",
      `/servers/${serverId}/channels`,
      {
        token: alice.token,
        body: { name: "dev-chat", type: "text" },
      },
    );
    expect(createStatus).toBe(201);
    const channelId = (createBody.channel as Record<string, unknown>).id as string;

    // List channels — should have #general + #dev-chat
    const { body: listBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    expect(listBody.channels as unknown[]).toHaveLength(2);

    // Update channel
    const { status: updateStatus, body: updateBody } = await apiRequest(
      "PATCH",
      `/channels/${channelId}`,
      {
        token: alice.token,
        body: { name: "engineering", topic: "Engineering discussion" },
      },
    );
    expect(updateStatus).toBe(200);
    expect((updateBody.channel as Record<string, unknown>).name).toBe("engineering");
    expect((updateBody.channel as Record<string, unknown>).topic).toBe("Engineering discussion");

    // Delete channel
    const { status: deleteStatus } = await apiRequest("DELETE", `/channels/${channelId}`, {
      token: alice.token,
    });
    expect(deleteStatus).toBe(200);

    // Only #general remains
    const { body: afterDelete } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    expect(afterDelete.channels as unknown[]).toHaveLength(1);
  });

  it("non-owner member cannot create/update/delete channels", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Test Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    // Bob joins
    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    // Bob cannot create channels
    const { status: createStatus } = await apiRequest("POST", `/servers/${serverId}/channels`, {
      token: bob.token,
      body: { name: "hacked-channel", type: "text" },
    });
    expect(createStatus).toBe(403);

    // Get #general channel id
    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const generalId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Bob cannot update channels
    const { status: updateStatus } = await apiRequest("PATCH", `/channels/${generalId}`, {
      token: bob.token,
      body: { name: "hacked" },
    });
    expect(updateStatus).toBe(403);

    // Bob cannot delete channels
    const { status: deleteStatus } = await apiRequest("DELETE", `/channels/${generalId}`, {
      token: bob.token,
    });
    expect(deleteStatus).toBe(403);
  });
});

// ── Message Journey ─────────────────────────────────────────────────────────

describe("E2E: Messages", () => {
  it("send → edit → verify edit → delete → verify gone", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Test Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Send message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Original text" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Edit message
    const { status: editStatus, body: editBody } = await apiRequest(
      "PATCH",
      `/messages/${messageId}`,
      {
        token: alice.token,
        body: { content: "Edited text" },
      },
    );
    expect(editStatus).toBe(200);
    expect((editBody.message as Record<string, unknown>).content).toBe("Edited text");
    expect((editBody.message as Record<string, unknown>).editedAt).not.toBeNull();

    // Verify edit persisted in message list
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const msgs = listBody.messages as Record<string, unknown>[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.content).toBe("Edited text");

    // Delete message
    await apiRequest("DELETE", `/messages/${messageId}`, { token: alice.token });

    // Verify message is gone
    const { body: emptyList } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    expect(emptyList.messages).toEqual([]);
  });

  it("message pagination: before cursor and limit", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Test Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Send 5 messages
    const messageIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
        token: alice.token,
        body: { content: `Message ${String(i)}` },
      });
      messageIds.push((msgBody.message as Record<string, unknown>).id as string);
    }

    // Get all messages (default limit) — returned newest-first
    const { body: allBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const all = allBody.messages as Record<string, unknown>[];
    expect(all).toHaveLength(5);
    expect(all[0]?.content).toBe("Message 5"); // newest first

    // Paginate: get 2 messages before the 3rd message (should get messages 1 and 2)
    const beforeMessageId = messageIds[2];
    expect(beforeMessageId).toBeDefined();
    if (!beforeMessageId) {
      throw new Error("Expected third message ID to exist for pagination test");
    }

    const { body: pageBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
      query: { before: beforeMessageId, limit: "2" },
    });
    const page = pageBody.messages as Record<string, unknown>[];
    expect(page).toHaveLength(2);
    expect(page[0]?.content).toBe("Message 2"); // newest of the two
    expect(page[1]?.content).toBe("Message 1");
  });

  it("message pagination rejects invalid cursor and limit values", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Pagination Validation Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { status: invalidLimitLow } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
      query: { limit: "0" },
    });
    expect(invalidLimitLow).toBe(400);

    const { status: invalidLimitHigh } = await apiRequest(
      "GET",
      `/channels/${channelId}/messages`,
      {
        token: alice.token,
        query: { limit: "1000" },
      },
    );
    expect(invalidLimitHigh).toBe(400);

    const { status: invalidBefore } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
      query: { before: "not-a-snowflake" },
    });
    expect(invalidBefore).toBe(400);
  });

  it("server owner can delete another member's message", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Test Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Bob sends a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: bob.token,
      body: { content: "Bob's message" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Alice (owner) deletes Bob's message
    const { status: deleteStatus } = await apiRequest("DELETE", `/messages/${messageId}`, {
      token: alice.token,
    });
    expect(deleteStatus).toBe(200);

    // Message is gone
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    expect(listBody.messages).toEqual([]);
  });

  it("member cannot edit or delete another member's message", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Test Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Alice sends a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Alice's message" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Bob cannot edit Alice's message
    const { status: editStatus } = await apiRequest("PATCH", `/messages/${messageId}`, {
      token: bob.token,
      body: { content: "Hacked" },
    });
    expect(editStatus).toBe(403);

    // Bob cannot delete Alice's message (not owner, no MANAGE_MESSAGES)
    const { status: deleteStatus } = await apiRequest("DELETE", `/messages/${messageId}`, {
      token: bob.token,
    });
    expect(deleteStatus).toBe(403);

    // Message is unchanged
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    expect((listBody.messages as Record<string, unknown>[])[0]?.content).toBe("Alice's message");
  });

  it("DM: both users can send, edit own, and delete own messages", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    const { body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    // Both send messages
    const { body: aliceMsg } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "From Alice" },
    });
    const aliceMsgId = (aliceMsg.message as Record<string, unknown>).id as string;

    const { body: bobMsg } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: bob.token,
      body: { content: "From Bob" },
    });
    const bobMsgId = (bobMsg.message as Record<string, unknown>).id as string;

    // Alice edits her own message
    const { status: editStatus } = await apiRequest("PATCH", `/messages/${aliceMsgId}`, {
      token: alice.token,
      body: { content: "Edited by Alice" },
    });
    expect(editStatus).toBe(200);

    // Alice cannot edit Bob's message
    const { status: crossEdit } = await apiRequest("PATCH", `/messages/${bobMsgId}`, {
      token: alice.token,
      body: { content: "Tampered" },
    });
    expect(crossEdit).toBe(403);

    // Alice cannot delete Bob's message in DM
    const { status: crossDelete } = await apiRequest("DELETE", `/messages/${bobMsgId}`, {
      token: alice.token,
    });
    expect(crossDelete).toBe(403);

    // Bob deletes his own message
    await apiRequest("DELETE", `/messages/${bobMsgId}`, { token: bob.token });

    // Only Alice's edited message remains
    const { body: finalMsgs } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const remaining = finalMsgs.messages as Record<string, unknown>[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.content).toBe("Edited by Alice");
  });

  it("POST /channels/:channelId/typing returns 204 for members and 403 for non-members", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const charlie = await registerUser("charlie");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Typing Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { status: okStatus } = await apiRequest("POST", `/channels/${channelId}/typing`, {
      token: bob.token,
    });
    expect(okStatus).toBe(204);

    const { status: forbiddenStatus } = await apiRequest("POST", `/channels/${channelId}/typing`, {
      token: charlie.token,
    });
    expect(forbiddenStatus).toBe(403);
  });

  it("user loses message read access after leaving a server", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Leave Read Access", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { status: readBeforeLeave } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: bob.token,
    });
    expect(readBeforeLeave).toBe(200);

    await apiRequest("POST", `/servers/${serverId}/leave`, { token: bob.token });

    const { status: readAfterLeave } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: bob.token,
    });
    expect(readAfterLeave).toBe(403);
  });
});

// ── Read State Journey ───────────────────────────────────────────────────────

describe("E2E: Read States", () => {
  it("PUT /channels/:channelId/ack updates last-read and GET /read-states returns it", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Read State Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { body: firstMsgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "First" },
    });
    const firstMessageId = (firstMsgBody.message as Record<string, unknown>).id as string;

    const { body: secondMsgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Second" },
    });
    const secondMessageId = (secondMsgBody.message as Record<string, unknown>).id as string;

    const { status: ack1Status } = await apiRequest("PUT", `/channels/${channelId}/ack`, {
      token: alice.token,
      body: { messageId: firstMessageId },
    });
    expect(ack1Status).toBe(204);

    const { status: ack2Status } = await apiRequest("PUT", `/channels/${channelId}/ack`, {
      token: alice.token,
      body: { messageId: secondMessageId },
    });
    expect(ack2Status).toBe(204);

    const { status: listStatus, body: listBody } = await apiRequest("GET", "/read-states", {
      token: alice.token,
    });
    expect(listStatus).toBe(200);

    const readStates = listBody.readStates as Record<string, unknown>[];
    expect(readStates).toHaveLength(1);
    expect(readStates[0]?.channelId).toBe(channelId);
    expect(readStates[0]?.lastReadMessageId).toBe(secondMessageId);
  });

  it("read-state ACK cannot move backwards", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Read State Monotonicity" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { body: firstMsgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Older" },
    });
    const firstMessageId = (firstMsgBody.message as Record<string, unknown>).id as string;

    const { body: secondMsgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Newer" },
    });
    const secondMessageId = (secondMsgBody.message as Record<string, unknown>).id as string;

    await apiRequest("PUT", `/channels/${channelId}/ack`, {
      token: alice.token,
      body: { messageId: secondMessageId },
    });
    await apiRequest("PUT", `/channels/${channelId}/ack`, {
      token: alice.token,
      body: { messageId: firstMessageId },
    });

    const { body: listBody } = await apiRequest("GET", "/read-states", {
      token: alice.token,
    });
    const readStates = listBody.readStates as Record<string, unknown>[];
    expect(readStates).toHaveLength(1);
    expect(readStates[0]?.lastReadMessageId).toBe(secondMessageId);
  });

  it("ACK rejects message from another channel and preserves existing read state", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Cross Channel ACK" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const generalId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { body: extraChannelBody } = await apiRequest("POST", `/servers/${serverId}/channels`, {
      token: alice.token,
      body: { name: "other", type: "text" },
    });
    const otherChannelId = (extraChannelBody.channel as Record<string, unknown>).id as string;

    const { body: msgBody } = await apiRequest("POST", `/channels/${generalId}/messages`, {
      token: alice.token,
      body: { content: "belongs-to-general" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    await apiRequest("PUT", `/channels/${generalId}/ack`, {
      token: alice.token,
      body: { messageId },
    });

    const { status: crossAckStatus } = await apiRequest("PUT", `/channels/${otherChannelId}/ack`, {
      token: alice.token,
      body: { messageId },
    });
    expect(crossAckStatus).toBe(400);

    const { body: listBody } = await apiRequest("GET", "/read-states", {
      token: alice.token,
    });
    const readStates = listBody.readStates as Record<string, unknown>[];
    const generalState = readStates.find((state) => state.channelId === generalId);
    const otherState = readStates.find((state) => state.channelId === otherChannelId);
    expect(generalState).toBeDefined();
    expect(generalState?.lastReadMessageId).toBe(messageId);
    expect(otherState).toBeUndefined();
  });

  it("read states are isolated per user in shared channels", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Per User Read State", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "shared-message" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    await apiRequest("PUT", `/channels/${channelId}/ack`, {
      token: alice.token,
      body: { messageId },
    });

    const { body: bobBefore } = await apiRequest("GET", "/read-states", { token: bob.token });
    expect(bobBefore.readStates).toEqual([]);

    await apiRequest("PUT", `/channels/${channelId}/ack`, {
      token: bob.token,
      body: { messageId },
    });
    const { body: bobAfter } = await apiRequest("GET", "/read-states", { token: bob.token });
    const bobStates = bobAfter.readStates as Record<string, unknown>[];
    expect(bobStates).toHaveLength(1);
    expect(bobStates[0]?.channelId).toBe(channelId);
    expect(bobStates[0]?.lastReadMessageId).toBe(messageId);
  });
});

// ── Replies & Mentions Journey ───────────────────────────────────────────────

describe("E2E: Replies & Mentions", () => {
  it("full reply flow: send → reply → view thread → delete original → reply shows null ref", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Reply Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Alice sends a message
    const { body: origBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Has anyone tried the new feature?" },
    });
    const origMsg = origBody.message as Record<string, unknown>;
    const origId = origMsg.id as string;
    expect(origMsg.replyToId).toBeNull();
    expect(origMsg.referencedMessage).toBeNull();

    // Bob replies to Alice's message
    const { status: replyStatus, body: replyBody } = await apiRequest(
      "POST",
      `/channels/${channelId}/messages`,
      {
        token: bob.token,
        body: { content: "Yes, it works great!", replyToId: origId },
      },
    );
    expect(replyStatus).toBe(201);
    const replyMsg = replyBody.message as Record<string, unknown>;
    expect(replyMsg.replyToId).toBe(origId);
    const replyRef = replyMsg.referencedMessage as Record<string, unknown>;
    expect(replyRef.id).toBe(origId);
    expect(replyRef.content).toBe("Has anyone tried the new feature?");
    expect((replyRef.author as Record<string, unknown>).username).toBe("alice");

    // Both see the thread when listing messages
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: bob.token,
    });
    const msgs = listBody.messages as Record<string, unknown>[];
    expect(msgs).toHaveLength(2);

    const bobReply = msgs.find((m) => m.content === "Yes, it works great!");
    expect(bobReply).toBeDefined();
    expect(bobReply!.replyToId).toBe(origId);
    const ref = bobReply!.referencedMessage as Record<string, unknown>;
    expect(ref.content).toBe("Has anyone tried the new feature?");

    // Alice deletes her original message
    await apiRequest("DELETE", `/messages/${origId}`, { token: alice.token });

    // Bob's reply now shows null referencedMessage (SET NULL on FK)
    const { body: afterDeleteBody } = await apiRequest(
      "GET",
      `/channels/${channelId}/messages`,
      { token: bob.token },
    );
    const afterMsgs = afterDeleteBody.messages as Record<string, unknown>[];
    expect(afterMsgs).toHaveLength(1);
    expect(afterMsgs[0]!.content).toBe("Yes, it works great!");
    expect(afterMsgs[0]!.replyToId).toBeNull();
    expect(afterMsgs[0]!.referencedMessage).toBeNull();
  });

  it("reply to message in different channel returns 404", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Multi Channel Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const generalId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Create a second channel
    const { body: ch2Body } = await apiRequest("POST", `/servers/${serverId}/channels`, {
      token: alice.token,
      body: { name: "dev", type: "text" },
    });
    const devId = (ch2Body.channel as Record<string, unknown>).id as string;

    // Send message in #general
    const { body: msgBody } = await apiRequest("POST", `/channels/${generalId}/messages`, {
      token: alice.token,
      body: { content: "General message" },
    });
    const generalMsgId = (msgBody.message as Record<string, unknown>).id as string;

    // Try to reply to #general message from #dev → 404
    const { status } = await apiRequest("POST", `/channels/${devId}/messages`, {
      token: alice.token,
      body: { content: "Cross-channel reply", replyToId: generalMsgId },
    });
    expect(status).toBe(404);
  });

  it("mentions: send message with mentions → verify in POST response and GET list", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const charlie = await registerUser("charlie");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Mention Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });
    await apiRequest("POST", `/servers/${serverId}/join`, { token: charlie.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Alice mentions both Bob and Charlie
    const { status, body } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: `Hey <@${bob.id}> and <@${charlie.id}>, check this out!` },
    });
    expect(status).toBe(201);
    const msg = body.message as Record<string, unknown>;
    const mentions = msg.mentions as string[];
    expect(mentions).toContain(bob.id);
    expect(mentions).toContain(charlie.id);
    expect(mentions).toHaveLength(2);

    // Verify mentions persist in GET
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const msgs = listBody.messages as Record<string, unknown>[];
    expect(msgs).toHaveLength(1);
    const listMentions = msgs[0]!.mentions as string[];
    expect(listMentions).toContain(bob.id);
    expect(listMentions).toContain(charlie.id);
  });

  it("mentions inside code blocks are ignored", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Code Mention Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { body } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: `Example: \`\`\`\n<@${bob.id}>\n\`\`\`` },
    });

    const msg = body.message as Record<string, unknown>;
    expect(msg.mentions).toEqual([]);
  });

  it("reply with mention: combined flow", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Reply + Mention Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Alice sends a message
    const { body: origBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "What do you think?" },
    });
    const origId = (origBody.message as Record<string, unknown>).id as string;

    // Bob replies mentioning Alice
    const { status, body } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: bob.token,
      body: {
        content: `<@${alice.id}> I think it's great!`,
        replyToId: origId,
      },
    });
    expect(status).toBe(201);
    const msg = body.message as Record<string, unknown>;
    expect(msg.replyToId).toBe(origId);
    expect((msg.referencedMessage as Record<string, unknown>).content).toBe("What do you think?");
    expect(msg.mentions).toEqual([alice.id]);
  });

  it("DM reply flow works", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    const { body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    // Alice sends a message
    const { body: origBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Hey, free for lunch?" },
    });
    const origId = (origBody.message as Record<string, unknown>).id as string;

    // Bob replies
    const { status, body } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: bob.token,
      body: { content: "Sure, 12:30?", replyToId: origId },
    });
    expect(status).toBe(201);
    const msg = body.message as Record<string, unknown>;
    expect(msg.replyToId).toBe(origId);
    expect((msg.referencedMessage as Record<string, unknown>).content).toBe("Hey, free for lunch?");

    // Both see the reply in the DM
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const msgs = listBody.messages as Record<string, unknown>[];
    expect(msgs).toHaveLength(2);
    const reply = msgs.find((m) => m.content === "Sure, 12:30?");
    expect(reply!.replyToId).toBe(origId);
  });
});

// ── Reactions Journey ────────────────────────────────────────────────────────

describe("E2E: Reactions", () => {
  it("send message → add reactions from multiple users → verify aggregation → remove → verify updated", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const charlie = await registerUser("charlie");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Reaction Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });
    await apiRequest("POST", `/servers/${serverId}/join`, { token: charlie.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Alice sends a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "React to this!" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // All three users react with 👍
    const thumbs = encodeURIComponent("👍");
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`, {
      token: alice.token,
    });
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`, {
      token: bob.token,
    });
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`, {
      token: charlie.token,
    });

    // Alice also reacts with 🔥
    const fire = encodeURIComponent("🔥");
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${fire}`, {
      token: alice.token,
    });

    // Verify aggregation from bob's perspective
    const { body: bobList } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: bob.token,
    });
    const bobMsgs = bobList.messages as Record<string, unknown>[];
    const bobMsg = bobMsgs.find((m) => m.id === messageId);
    const bobReactions = bobMsg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
    expect(bobReactions).toHaveLength(2);

    const bobThumbs = bobReactions.find((r) => r.emoji === "👍");
    expect(bobThumbs!.count).toBe(3);
    expect(bobThumbs!.me).toBe(true);

    const bobFire = bobReactions.find((r) => r.emoji === "🔥");
    expect(bobFire!.count).toBe(1);
    expect(bobFire!.me).toBe(false);

    // Bob removes his 👍 reaction
    await apiRequest(
      "DELETE",
      `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`,
      { token: bob.token },
    );

    // Verify count decreased
    const { body: afterRemove } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: bob.token,
    });
    const afterMsgs = afterRemove.messages as Record<string, unknown>[];
    const afterMsg = afterMsgs.find((m) => m.id === messageId);
    const afterReactions = afterMsg!.reactions as Array<{
      emoji: string;
      count: number;
      me: boolean;
    }>;
    const afterThumbs = afterReactions.find((r) => r.emoji === "👍");
    expect(afterThumbs!.count).toBe(2);
    expect(afterThumbs!.me).toBe(false);
  });

  it("deleting a message cascades its reactions", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Cascade Reactions Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Alice sends a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Will be deleted" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Both react
    const thumbs = encodeURIComponent("👍");
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`, {
      token: alice.token,
    });
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`, {
      token: bob.token,
    });

    // Delete the message
    await apiRequest("DELETE", `/messages/${messageId}`, { token: alice.token });

    // Verify message is gone
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    expect(listBody.messages).toEqual([]);
  });

  it("reactions work in DM channels", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    const { body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    // Alice sends a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "DM message" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Both react
    const heart = encodeURIComponent("❤️");
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${heart}`, {
      token: alice.token,
    });
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${heart}`, {
      token: bob.token,
    });

    // Verify reactions
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const msgs = listBody.messages as Record<string, unknown>[];
    const msg = msgs.find((m) => m.id === messageId);
    const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
    expect(reactions).toHaveLength(1);
    expect(reactions[0]!.count).toBe(2);
    expect(reactions[0]!.me).toBe(true);
  });

  it("newly created messages have empty reactions array", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Empty Reactions Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Fresh message" },
    });
    const msg = msgBody.message as Record<string, unknown>;
    expect(msg.reactions).toEqual([]);
  });
});

// ── Pinning Journey ──────────────────────────────────────────────────────────

describe("E2E: Pinning", () => {
  it("send message → pin → verify in pins list and messages → unpin → verify removed", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Pinning Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Send a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Important announcement" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Pin the message
    const { status: pinStatus } = await apiRequest(
      "PUT",
      `/channels/${channelId}/pins/${messageId}`,
      { token: alice.token },
    );
    expect(pinStatus).toBe(204);

    // Verify message appears in pins list
    const { body: pinsBody } = await apiRequest("GET", `/channels/${channelId}/pins`, {
      token: alice.token,
    });
    const pins = pinsBody.messages as Record<string, unknown>[];
    expect(pins).toHaveLength(1);
    expect(pins[0]!.content).toBe("Important announcement");
    expect(pins[0]!.pinnedAt).not.toBeNull();
    expect(pins[0]!.pinnedBy).toBe(alice.id);

    // Verify pinnedAt/pinnedBy appear in messages list
    const { body: msgsBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const msgs = msgsBody.messages as Record<string, unknown>[];
    const msg = msgs.find((m) => m.id === messageId);
    expect(msg!.pinnedAt).not.toBeNull();
    expect(msg!.pinnedBy).toBe(alice.id);

    // Unpin
    const { status: unpinStatus } = await apiRequest(
      "DELETE",
      `/channels/${channelId}/pins/${messageId}`,
      { token: alice.token },
    );
    expect(unpinStatus).toBe(204);

    // Verify removed from pins list
    const { body: emptyPins } = await apiRequest("GET", `/channels/${channelId}/pins`, {
      token: alice.token,
    });
    expect((emptyPins.messages as unknown[]).length).toBe(0);

    // Verify pinnedAt/pinnedBy are null in messages list
    const { body: afterUnpin } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const afterMsg = (afterUnpin.messages as Record<string, unknown>[]).find(
      (m) => m.id === messageId,
    );
    expect(afterMsg!.pinnedAt).toBeNull();
    expect(afterMsg!.pinnedBy).toBeNull();
  });

  it("non-privileged member cannot pin, owner can", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Pin Permissions Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Bob sends a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: bob.token,
      body: { content: "Bob's message" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Bob tries to pin — should fail
    const { status: bobPinStatus } = await apiRequest(
      "PUT",
      `/channels/${channelId}/pins/${messageId}`,
      { token: bob.token },
    );
    expect(bobPinStatus).toBe(403);

    // Alice (owner) pins it — should succeed
    const { status: alicePinStatus } = await apiRequest(
      "PUT",
      `/channels/${channelId}/pins/${messageId}`,
      { token: alice.token },
    );
    expect(alicePinStatus).toBe(204);

    // Bob can still see pinned messages
    const { status: listStatus, body: pinsBody } = await apiRequest(
      "GET",
      `/channels/${channelId}/pins`,
      { token: bob.token },
    );
    expect(listStatus).toBe(200);
    expect((pinsBody.messages as unknown[]).length).toBe(1);
  });

  it("pinning in DMs works for both participants", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    await makeFriends(alice, "bob", bob);

    const { body: dmBody } = await apiRequest("POST", "/dms", {
      token: alice.token,
      body: { recipientId: bob.id },
    });
    const channelId = (dmBody.channel as Record<string, unknown>).id as string;

    // Alice sends message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Pin-worthy DM" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Bob pins it
    const { status: pinStatus } = await apiRequest(
      "PUT",
      `/channels/${channelId}/pins/${messageId}`,
      { token: bob.token },
    );
    expect(pinStatus).toBe(204);

    // Both see it in pins
    const { body: alicePins } = await apiRequest("GET", `/channels/${channelId}/pins`, {
      token: alice.token,
    });
    expect((alicePins.messages as unknown[]).length).toBe(1);

    const { body: bobPins } = await apiRequest("GET", `/channels/${channelId}/pins`, {
      token: bob.token,
    });
    expect((bobPins.messages as unknown[]).length).toBe(1);
  });

  it("deleting a pinned message removes it from pins list", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Delete Pinned Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Send and pin a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Pinned then deleted" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    await apiRequest("PUT", `/channels/${channelId}/pins/${messageId}`, {
      token: alice.token,
    });

    // Verify pinned
    const { body: beforeDelete } = await apiRequest("GET", `/channels/${channelId}/pins`, {
      token: alice.token,
    });
    expect((beforeDelete.messages as unknown[]).length).toBe(1);

    // Delete the message
    await apiRequest("DELETE", `/messages/${messageId}`, { token: alice.token });

    // Verify removed from pins
    const { body: afterDelete } = await apiRequest("GET", `/channels/${channelId}/pins`, {
      token: alice.token,
    });
    expect((afterDelete.messages as unknown[]).length).toBe(0);
  });

  it("reactions and pins work together on the same message", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Combined Features Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Alice sends a message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Pin and react to this" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Pin it
    await apiRequest("PUT", `/channels/${channelId}/pins/${messageId}`, {
      token: alice.token,
    });

    // Both react
    const thumbs = encodeURIComponent("👍");
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`, {
      token: alice.token,
    });
    await apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${thumbs}`, {
      token: bob.token,
    });

    // Verify message shows both pin info and reactions
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: bob.token,
    });
    const msgs = listBody.messages as Record<string, unknown>[];
    const msg = msgs.find((m) => m.id === messageId);
    expect(msg!.pinnedAt).not.toBeNull();
    expect(msg!.pinnedBy).toBe(alice.id);

    const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
    expect(reactions).toHaveLength(1);
    expect(reactions[0]!.count).toBe(2);
    expect(reactions[0]!.me).toBe(true); // bob reacted
  });
});

// ── Cross-feature Edge Cases ────────────────────────────────────────────────

describe("E2E: Cross-feature Edge Cases", () => {
  it("deleting a server cascades channels and messages", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Doomed Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    // Send a message
    await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "This will be deleted" },
    });

    // Delete server
    await apiRequest("DELETE", `/servers/${serverId}`, { token: alice.token });

    // Channel messages should 404 (channel doesn't exist)
    const { status } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    expect(status).toBe(404);
  });

  it("deleting a server also removes read-state rows for its channels", async () => {
    const alice = await registerUser("alice");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Read State Cleanup Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelsBody } = await apiRequest("GET", `/servers/${serverId}/channels`, {
      token: alice.token,
    });
    const channelId = (channelsBody.channels as Record<string, unknown>[])[0]?.id as string;

    const { body: messageBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "ack-me" },
    });
    const messageId = (messageBody.message as Record<string, unknown>).id as string;

    await apiRequest("PUT", `/channels/${channelId}/ack`, {
      token: alice.token,
      body: { messageId },
    });

    const { body: beforeDelete } = await apiRequest("GET", "/read-states", { token: alice.token });
    expect(beforeDelete.readStates as unknown[]).toHaveLength(1);

    await apiRequest("DELETE", `/servers/${serverId}`, { token: alice.token });

    const { body: afterDelete } = await apiRequest("GET", "/read-states", { token: alice.token });
    expect(afterDelete.readStates).toEqual([]);
  });

  it("cannot double-join a server", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Public Server", isPublic: true },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    await apiRequest("POST", `/servers/${serverId}/join`, { token: bob.token, body: {} });

    // Try to join again
    const { status } = await apiRequest("POST", `/servers/${serverId}/join`, {
      token: bob.token,
      body: {},
    });
    expect(status).toBe(409);
  });
});

// ── Rich Media E2E ──────────────────────────────────────────────────────────

describe("E2E: Rich Media", () => {
  it("message with attachments → list includes attachments → delete cascades", async () => {
    const { attachments: attachmentsTable, db: database } = await import("@cove/db");
    const { generateSnowflake } = await import("@cove/shared");

    const alice = await registerUser("rich_alice1");

    // Create server and channel
    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Media Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelBody } = await apiRequest("POST", `/servers/${serverId}/channels`, {
      token: alice.token,
      body: { name: "media", type: "text" },
    });
    const channelId = (channelBody.channel as Record<string, unknown>).id as string;

    // Create a message with attachment placeholder
    const attachmentId = generateSnowflake();
    await database.insert(attachmentsTable).values({
      id: BigInt(attachmentId),
      messageId: sql`NULL`,
      channelId: BigInt(channelId),
      uploaderId: BigInt(alice.id),
      filename: "screenshot.png",
      contentType: "image/png",
      size: 5000,
      url: "/uploads/screenshot.png",
      storageKey: "attachments/e2e/screenshot.png",
    });

    // Send message with attachment
    const { status: createStatus, body: createBody } = await apiRequest(
      "POST",
      `/channels/${channelId}/messages`,
      {
        token: alice.token,
        body: { content: "Here's a screenshot", attachmentIds: [attachmentId] },
      },
    );

    expect(createStatus).toBe(201);
    const createdMsg = createBody.message as Record<string, unknown>;
    const createdAttachments = createdMsg.attachments as Array<Record<string, unknown>>;
    expect(createdAttachments).toHaveLength(1);
    expect(createdAttachments[0]!.filename).toBe("screenshot.png");

    const messageId = createdMsg.id as string;

    // Verify listing includes attachment
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const messages = listBody.messages as Array<Record<string, unknown>>;
    const found = messages.find((m) => m.id === messageId) as Record<string, unknown>;
    expect((found.attachments as unknown[]).length).toBe(1);

    // Delete message - attachments should cascade
    await apiRequest("DELETE", `/messages/${messageId}`, { token: alice.token });

    const { eq } = await import("drizzle-orm");
    const rows = await database
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, BigInt(attachmentId)));
    expect(rows).toHaveLength(0);
  });

  it("embeds are returned in message listing after creation", async () => {
    const { embeds: embedsTable, db: database } = await import("@cove/db");
    const { generateSnowflake } = await import("@cove/shared");

    const alice = await registerUser("rich_alice2");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Embed Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelBody } = await apiRequest("POST", `/servers/${serverId}/channels`, {
      token: alice.token,
      body: { name: "links", type: "text" },
    });
    const channelId = (channelBody.channel as Record<string, unknown>).id as string;

    // Send message
    const { body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: { content: "Check out https://example.com" },
    });
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Simulate async embed generation
    const embedId = generateSnowflake();
    await database.insert(embedsTable).values({
      id: BigInt(embedId),
      messageId: BigInt(messageId),
      url: "https://example.com",
      title: "Example Domain",
      description: "This domain is for use in illustrative examples.",
      siteName: "Example",
    });

    // Verify embeds show up in listing
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });
    const messages = listBody.messages as Array<Record<string, unknown>>;
    const found = messages.find((m) => m.id === messageId) as Record<string, unknown>;
    const embedList = found.embeds as Array<Record<string, unknown>>;
    expect(embedList).toHaveLength(1);
    expect(embedList[0]!.title).toBe("Example Domain");
    expect(embedList[0]!.url).toBe("https://example.com");
  });

  it("custom emojis: create → list → delete lifecycle", async () => {
    const { customEmojis: emojisTable, db: database } = await import("@cove/db");
    const { generateSnowflake } = await import("@cove/shared");

    const alice = await registerUser("rich_alice3");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Emoji Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    // Insert emoji directly (upload would need multipart)
    const emojiId = generateSnowflake();
    await database.insert(emojisTable).values({
      id: BigInt(emojiId),
      serverId: BigInt(serverId),
      name: "partyblob",
      imageUrl: "/uploads/emojis/partyblob.gif",
      storageKey: "emojis/e2e/partyblob.gif",
      creatorId: BigInt(alice.id),
    });

    // List emojis
    const { status: listStatus, body: listBody } = await apiRequest(
      "GET",
      `/servers/${serverId}/emojis`,
      { token: alice.token },
    );
    expect(listStatus).toBe(200);
    const emojis = listBody.emojis as Array<Record<string, unknown>>;
    expect(emojis).toHaveLength(1);
    expect(emojis[0]!.name).toBe("partyblob");

    // Delete emoji
    const { status: deleteStatus } = await apiRequest(
      "DELETE",
      `/servers/${serverId}/emojis/${emojiId}`,
      { token: alice.token },
    );
    expect(deleteStatus).toBe(200);

    // Verify gone
    const { body: afterDelete } = await apiRequest("GET", `/servers/${serverId}/emojis`, {
      token: alice.token,
    });
    expect(afterDelete.emojis).toEqual([]);
  });

  it("full rich message flow: create message → add attachment + embed → list → verify all fields", async () => {
    const { attachments: attachmentsTable, embeds: embedsTable, db: database } = await import("@cove/db");
    const { generateSnowflake } = await import("@cove/shared");

    const alice = await registerUser("rich_alice4");

    const { body: serverBody } = await apiRequest("POST", "/servers", {
      token: alice.token,
      body: { name: "Full Rich Server" },
    });
    const serverId = (serverBody.server as Record<string, unknown>).id as string;

    const { body: channelBody } = await apiRequest("POST", `/servers/${serverId}/channels`, {
      token: alice.token,
      body: { name: "rich-content", type: "text" },
    });
    const channelId = (channelBody.channel as Record<string, unknown>).id as string;

    // Create attachment placeholder
    const attachmentId = generateSnowflake();
    await database.insert(attachmentsTable).values({
      id: BigInt(attachmentId),
      messageId: sql`NULL`,
      channelId: BigInt(channelId),
      uploaderId: BigInt(alice.id),
      filename: "design.pdf",
      contentType: "application/pdf",
      size: 102400,
      url: "/uploads/design.pdf",
      storageKey: "attachments/e2e/design.pdf",
    });

    // Send message with attachment
    const { status, body: msgBody } = await apiRequest("POST", `/channels/${channelId}/messages`, {
      token: alice.token,
      body: {
        content: "New design spec https://figma.com/file/abc",
        attachmentIds: [attachmentId],
      },
    });

    expect(status).toBe(201);
    const messageId = (msgBody.message as Record<string, unknown>).id as string;

    // Simulate embed generation
    await database.insert(embedsTable).values({
      id: BigInt(generateSnowflake()),
      messageId: BigInt(messageId),
      url: "https://figma.com/file/abc",
      title: "Design Spec - Figma",
      description: "View the latest design spec",
      siteName: "Figma",
      thumbnailUrl: "https://figma.com/thumbnail.png",
    });

    // Fetch messages and verify everything is present
    const { body: listBody } = await apiRequest("GET", `/channels/${channelId}/messages`, {
      token: alice.token,
    });

    const messages = listBody.messages as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(1);
    const msg = messages[0]!;

    // Content
    expect(msg.content).toBe("New design spec https://figma.com/file/abc");

    // Author
    const author = msg.author as Record<string, unknown>;
    expect(author.id).toBe(alice.id);

    // Attachments
    const msgAttachments = msg.attachments as Array<Record<string, unknown>>;
    expect(msgAttachments).toHaveLength(1);
    expect(msgAttachments[0]!.filename).toBe("design.pdf");
    expect(msgAttachments[0]!.contentType).toBe("application/pdf");
    expect(msgAttachments[0]!.size).toBe(102400);

    // Embeds
    const msgEmbeds = msg.embeds as Array<Record<string, unknown>>;
    expect(msgEmbeds).toHaveLength(1);
    expect(msgEmbeds[0]!.title).toBe("Design Spec - Figma");
    expect(msgEmbeds[0]!.url).toBe("https://figma.com/file/abc");
    expect(msgEmbeds[0]!.siteName).toBe("Figma");
    expect(msgEmbeds[0]!.thumbnailUrl).toBe("https://figma.com/thumbnail.png");

    // Also verify the message has the standard fields
    expect(msg.reactions).toEqual([]);
    expect(msg.replyToId).toBe(null);
    expect(msg.pinnedAt).toBe(null);
  });
});
