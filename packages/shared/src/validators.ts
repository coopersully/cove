import { z } from "zod";

import { MAX_CHANNEL_NAME_LENGTH, MAX_MESSAGE_LENGTH } from "./constants.js";

export const snowflakeSchema = z.string().regex(/^\d+$/, "Invalid snowflake ID");

export const channelNameSchema = z
  .string()
  .min(1, "Channel name is required")
  .max(
    MAX_CHANNEL_NAME_LENGTH,
    `Channel name must be at most ${String(MAX_CHANNEL_NAME_LENGTH)} characters`,
  );

export const messageContentSchema = z
  .string()
  .min(1, "Message cannot be empty")
  .max(MAX_MESSAGE_LENGTH, `Message must be at most ${String(MAX_MESSAGE_LENGTH)} characters`);
