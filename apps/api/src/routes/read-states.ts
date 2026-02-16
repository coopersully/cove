import { getUser, requireAuth } from "@cove/auth";
import { channelReadStates, db, messages } from "@cove/db";
import { AppError, snowflakeSchema } from "@cove/shared";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireChannelMembership } from "../lib/channel-membership.js";
import { validate } from "../middleware/index.js";

const ackSchema = z.object({
	messageId: snowflakeSchema,
});

export const readStateRoutes = new Hono();

readStateRoutes.use(requireAuth());

// PUT /channels/:channelId/ack
readStateRoutes.put("/channels/:channelId/ack", validate(ackSchema), async (c) => {
	const user = getUser(c);
	const channelId = c.req.param("channelId");
	const body = c.get("body");
	const ackMessageId = BigInt(body.messageId);

	const channel = await requireChannelMembership(channelId, user.id);
	const [message] = await db
		.select({ id: messages.id, channelId: messages.channelId })
		.from(messages)
		.where(eq(messages.id, ackMessageId))
		.limit(1);

	if (!message) {
		throw new AppError("NOT_FOUND", "Message not found");
	}

	if (String(message.channelId) !== channel.id) {
		throw new AppError("VALIDATION_ERROR", "Message does not belong to this channel");
	}

	await db
		.insert(channelReadStates)
		.values({
			userId: BigInt(user.id),
			channelId: BigInt(channel.id),
			lastReadMessageId: ackMessageId,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [channelReadStates.userId, channelReadStates.channelId],
			set: {
				lastReadMessageId: sql`CASE
					WHEN ${channelReadStates.lastReadMessageId} IS NULL
						OR ${channelReadStates.lastReadMessageId} < ${ackMessageId}
					THEN ${ackMessageId}
					ELSE ${channelReadStates.lastReadMessageId}
				END`,
				updatedAt: new Date(),
			},
		});

	return c.body(null, 204);
});

// GET /read-states
readStateRoutes.get("/read-states", async (c) => {
	const user = getUser(c);

	const results = await db
		.select()
		.from(channelReadStates)
		.where(eq(channelReadStates.userId, BigInt(user.id)));

	return c.json({
		readStates: results.map((rs) => ({
			channelId: String(rs.channelId),
			lastReadMessageId: rs.lastReadMessageId ? String(rs.lastReadMessageId) : null,
			updatedAt: rs.updatedAt,
		})),
	});
});
