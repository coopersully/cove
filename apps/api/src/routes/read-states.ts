import { getUser, requireAuth } from "@cove/auth";
import { channelReadStates, db } from "@cove/db";
import { snowflakeSchema } from "@cove/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

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

	await db
		.insert(channelReadStates)
		.values({
			userId: BigInt(user.id),
			channelId: BigInt(channelId),
			lastReadMessageId: BigInt(body.messageId),
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [channelReadStates.userId, channelReadStates.channelId],
			set: {
				lastReadMessageId: BigInt(body.messageId),
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
