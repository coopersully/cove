import { hashPassword } from "@cove/auth";
import { generateAccessToken } from "@cove/auth";
import {
  channels,
  db,
  dmMembers,
  friendships,
  inviteCodes,
  serverMembers,
  servers,
  users,
} from "@cove/db";
import { generateSnowflake } from "@cove/shared";

let userCounter = 0;

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  token: string;
}

export async function createTestUser(
  overrides: { username?: string; email?: string; password?: string } = {},
): Promise<TestUser> {
  userCounter++;
  const id = generateSnowflake();
  const username = overrides.username ?? `testuser${String(userCounter)}_${id.slice(-4)}`;
  const email = overrides.email ?? `${username}@test.com`;
  const password = overrides.password ?? "TestPass1";

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id: BigInt(id),
    username,
    email,
    passwordHash,
  });

  const token = await generateAccessToken(id, username);

  return { id, username, email, password, token };
}

export async function createTestFriendship(
  userAId: string,
  userBId: string,
  status: "pending" | "accepted" = "accepted",
) {
  const id = generateSnowflake();

  await db.insert(friendships).values({
    id: BigInt(id),
    requesterId: BigInt(userAId),
    addresseeId: BigInt(userBId),
    status,
  });

  return { id };
}

export async function createTestServer(ownerId: string) {
  const id = generateSnowflake();
  const name = `Test Server ${id.slice(-4)}`;

  await db.insert(servers).values({
    id: BigInt(id),
    name,
    ownerId: BigInt(ownerId),
  });

  await db.insert(serverMembers).values({
    serverId: BigInt(id),
    userId: BigInt(ownerId),
    role: "owner",
  });

  return { id, name };
}

export async function createTestChannel(
  serverId: string,
  overrides: { name?: string; type?: "text" | "voice" } = {},
) {
  const id = generateSnowflake();

  await db.insert(channels).values({
    id: BigInt(id),
    serverId: BigInt(serverId),
    name: overrides.name ?? `test-channel-${id.slice(-4)}`,
    type: overrides.type ?? "text",
  });

  return { id };
}

export async function createTestInviteCode(
  serverId: string,
  creatorId: string,
  overrides: { maxUses?: number; expiresAt?: Date } = {},
) {
  const id = generateSnowflake();
  const code = `invite-${id.slice(-8)}`;

  await db.insert(inviteCodes).values({
    id: BigInt(id),
    serverId: BigInt(serverId),
    creatorId: BigInt(creatorId),
    code,
    maxUses: overrides.maxUses ?? null,
    expiresAt: overrides.expiresAt ?? null,
  });

  return { id, code };
}

export async function createTestDm(userAId: string, userBId: string) {
  const channelId = generateSnowflake();

  await db.insert(channels).values({
    id: BigInt(channelId),
    serverId: null,
    name: "",
    type: "dm",
    position: 0,
  });

  await db.insert(dmMembers).values([
    { channelId: BigInt(channelId), userId: BigInt(userAId) },
    { channelId: BigInt(channelId), userId: BigInt(userBId) },
  ]);

  return { channelId };
}
