import { channels, db, dmMembers, serverMembers } from "@cove/db";
import { AppError, snowflakeSchema } from "@cove/shared";
import { and, eq } from "drizzle-orm";

export interface ChannelMembership {
  id: string;
  type: string;
  serverId: string | null;
}

export async function requireChannelMembership(
  channelId: string,
  userId: string,
): Promise<ChannelMembership> {
  const parsedChannelId = snowflakeSchema.safeParse(channelId);
  if (!parsedChannelId.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid channel ID");
  }

  const normalizedChannelId = parsedChannelId.data;

  const [channel] = await db
    .select({ serverId: channels.serverId, type: channels.type })
    .from(channels)
    .where(eq(channels.id, BigInt(normalizedChannelId)))
    .limit(1);

  if (!channel) {
    throw new AppError("NOT_FOUND", "Channel not found");
  }

  if (channel.type === "dm") {
    const [member] = await db
      .select({ userId: dmMembers.userId })
      .from(dmMembers)
      .where(
        and(
          eq(dmMembers.channelId, BigInt(normalizedChannelId)),
          eq(dmMembers.userId, BigInt(userId)),
        ),
      )
      .limit(1);

    if (!member) {
      throw new AppError("FORBIDDEN", "You are not a member of this DM");
    }
  } else {
    if (!channel.serverId) {
      throw new AppError("INTERNAL_ERROR", "Server channel has no server");
    }

    const [member] = await db
      .select({ userId: serverMembers.userId })
      .from(serverMembers)
      .where(
        and(eq(serverMembers.serverId, channel.serverId), eq(serverMembers.userId, BigInt(userId))),
      )
      .limit(1);

    if (!member) {
      throw new AppError("FORBIDDEN", "You are not a member of this server");
    }
  }

  return {
    id: normalizedChannelId,
    type: channel.type,
    serverId: channel.serverId ? String(channel.serverId) : null,
  };
}
