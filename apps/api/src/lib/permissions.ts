import { db, roles, serverMembers } from "@cove/db";
import { and, eq } from "drizzle-orm";

/**
 * Compute the merged permission bitfield for a user in a server.
 * For MVP: all members get the union of all server roles' permissions.
 * Future: map individual role assignments per member.
 */
export async function getMemberPermissions(serverId: string, userId: string): Promise<bigint> {
  const [member] = await db
    .select()
    .from(serverMembers)
    .where(
      and(eq(serverMembers.serverId, BigInt(serverId)), eq(serverMembers.userId, BigInt(userId))),
    )
    .limit(1);

  if (!member) {
    return 0n;
  }

  // Get @everyone role (position 0) for this server
  const serverRoles = await db
    .select({ permissions: roles.permissions, name: roles.name })
    .from(roles)
    .where(eq(roles.serverId, BigInt(serverId)));

  let merged = 0n;
  for (const role of serverRoles) {
    if (role.name === "@everyone") {
      merged |= role.permissions;
    }
  }

  return merged;
}
