import { getUser, requireAuth } from "@cove/auth";
import { attachments, db, messages } from "@cove/db";
import { AppError, generateSnowflake, snowflakeSchema } from "@cove/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";

import { requireChannelMembership } from "../lib/channel-membership.js";
import { getStorage } from "../lib/storage.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "application/pdf",
  "text/plain",
]);

export const attachmentRoutes = new Hono();

attachmentRoutes.use(requireAuth());

interface AttachmentResponse {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  width: number | null;
  height: number | null;
}

type AttachmentQueryDb = Pick<typeof db, "select" | "update">;

// POST /channels/:channelId/attachments
attachmentRoutes.post("/channels/:channelId/attachments", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  await requireChannelMembership(channelId, user.id);

  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!(file && file instanceof File)) {
    throw new AppError("VALIDATION_ERROR", "No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError("VALIDATION_ERROR", "File size exceeds 25 MB limit");
  }

  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new AppError("VALIDATION_ERROR", `File type ${file.type} is not allowed`);
  }

  const attachmentId = generateSnowflake();
  const ext = file.name.split(".").pop() ?? "";
  const key = `attachments/${channelId}/${attachmentId}${ext ? `.${ext}` : ""}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  let url: string;
  try {
    url = await storage.upload(key, buffer, file.type);
  } catch {
    throw new AppError("INTERNAL_ERROR", "Failed to upload attachment");
  }

  let created: typeof attachments.$inferSelect | undefined;
  try {
    [created] = await db
      .insert(attachments)
      .values({
        id: BigInt(attachmentId),
        messageId: sql`NULL`, // Unlinked until message creation
        channelId: BigInt(channelId),
        uploaderId: BigInt(user.id),
        filename: file.name,
        contentType: file.type,
        size: file.size,
        url,
        storageKey: key,
      })
      .returning();
  } catch {
    await storage.delete(key).catch(() => {});
    throw new AppError("INTERNAL_ERROR", "Failed to create attachment");
  }

  if (!created) {
    await storage.delete(key).catch(() => {});
    throw new AppError("INTERNAL_ERROR", "Failed to create attachment");
  }

  return c.json(
    {
      attachment: {
        id: String(created.id),
        filename: created.filename,
        contentType: created.contentType,
        size: created.size,
        url: created.url,
      },
    },
    201,
  );
});

// GET /attachments/:id
attachmentRoutes.get("/attachments/:id", async (c) => {
  const user = getUser(c);
  const parsed = snowflakeSchema.safeParse(c.req.param("id"));
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid attachment ID");
  }

  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, BigInt(parsed.data)))
    .limit(1);

  if (!attachment) {
    throw new AppError("NOT_FOUND", "Attachment not found");
  }

  let attachmentChannelId = attachment.channelId ? String(attachment.channelId) : null;
  if (!attachmentChannelId && attachment.messageId) {
    const [message] = await db
      .select({ channelId: messages.channelId })
      .from(messages)
      .where(eq(messages.id, attachment.messageId))
      .limit(1);
    attachmentChannelId = message?.channelId ? String(message.channelId) : null;
  }

  if (!attachmentChannelId) {
    throw new AppError("FORBIDDEN", "Attachment is not accessible");
  }

  await requireChannelMembership(attachmentChannelId, user.id);

  // Unlinked attachments remain private to the uploader.
  if (
    attachment.messageId === null &&
    (!attachment.uploaderId || String(attachment.uploaderId) !== user.id)
  ) {
    throw new AppError("FORBIDDEN", "You do not have access to this attachment");
  }

  return c.json({
    attachment: {
      id: String(attachment.id),
      messageId: attachment.messageId ? String(attachment.messageId) : null,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      url: attachment.url,
      width: attachment.width,
      height: attachment.height,
    },
  });
});

// Helper: link attachment IDs to a message, returns attachment data
export async function linkAttachmentsToMessage(
  attachmentIds: string[],
  messageId: string,
  channelId: string,
  uploaderId: string,
  queryDb: AttachmentQueryDb = db,
): Promise<AttachmentResponse[]> {
  if (attachmentIds.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(attachmentIds)];
  const attachmentBigInts = uniqueIds.map((id) => BigInt(id));
  const normalizedChannelId = BigInt(channelId);
  const normalizedUploaderId = BigInt(uploaderId);

  const existing = await queryDb
    .select()
    .from(attachments)
    .where(inArray(attachments.id, attachmentBigInts));

  if (existing.length !== attachmentBigInts.length) {
    throw new AppError("NOT_FOUND", "One or more attachments were not found");
  }

  if (existing.some((attachment) => attachment.messageId !== null)) {
    throw new AppError("CONFLICT", "One or more attachments are already linked");
  }

  if (
    existing.some(
      (attachment) =>
        attachment.channelId === null ||
        attachment.uploaderId === null ||
        attachment.channelId !== normalizedChannelId ||
        attachment.uploaderId !== normalizedUploaderId,
    )
  ) {
    throw new AppError("FORBIDDEN", "One or more attachments cannot be linked");
  }

  const linked = await queryDb
    .update(attachments)
    .set({ messageId: BigInt(messageId) })
    .where(
      and(
        inArray(attachments.id, attachmentBigInts),
        isNull(attachments.messageId),
        eq(attachments.channelId, normalizedChannelId),
        eq(attachments.uploaderId, normalizedUploaderId),
      ),
    )
    .returning();

  if (linked.length !== attachmentBigInts.length) {
    throw new AppError("CONFLICT", "Failed to link one or more attachments");
  }

  return linked.map((a) => ({
    id: String(a.id),
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
    url: a.url,
    width: a.width,
    height: a.height,
  }));
}

// Helper: fetch attachments for a list of message IDs
export async function getAttachmentsForMessages(messageIds: bigint[]): Promise<
  Map<
    string,
    {
      id: string;
      filename: string;
      contentType: string;
      size: number;
      url: string;
      width: number | null;
      height: number | null;
    }[]
  >
> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.messageId, messageIds));

  const byMessage = new Map<
    string,
    {
      id: string;
      filename: string;
      contentType: string;
      size: number;
      url: string;
      width: number | null;
      height: number | null;
    }[]
  >();

  for (const row of rows) {
    const key = String(row.messageId);
    if (!byMessage.has(key)) {
      byMessage.set(key, []);
    }
    byMessage.get(key)?.push({
      id: String(row.id),
      filename: row.filename,
      contentType: row.contentType,
      size: row.size,
      url: row.url,
      width: row.width,
      height: row.height,
    });
  }

  return byMessage;
}
