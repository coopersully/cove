import { z } from "zod";

import {
  MAX_BIO_LENGTH,
  MAX_CHANNEL_NAME_LENGTH,
  MAX_CHANNEL_TOPIC_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGE_LIMIT,
  MAX_PRONOUNS_LENGTH,
  MAX_SERVER_DESCRIPTION_LENGTH,
  MAX_SERVER_NAME_LENGTH,
  MAX_STATUS_EMOJI_LENGTH,
  MAX_STATUS_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
} from "./constants.js";

export const snowflakeSchema = z.string().regex(/^\d+$/, "Invalid snowflake ID");

export const usernameSchema = z
  .string()
  .min(MIN_USERNAME_LENGTH, `Username must be at least ${String(MIN_USERNAME_LENGTH)} characters`)
  .max(MAX_USERNAME_LENGTH, `Username must be at most ${String(MAX_USERNAME_LENGTH)} characters`)
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(MAX_EMAIL_LENGTH, `Email must be at most ${String(MAX_EMAIL_LENGTH)} characters`);

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters`)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a number");

export const displayNameSchema = z
  .string()
  .max(
    MAX_DISPLAY_NAME_LENGTH,
    `Display name must be at most ${String(MAX_DISPLAY_NAME_LENGTH)} characters`,
  );

export const statusSchema = z
  .string()
  .max(MAX_STATUS_LENGTH, `Status must be at most ${String(MAX_STATUS_LENGTH)} characters`);

export const bioSchema = z
  .string()
  .max(MAX_BIO_LENGTH, `Bio must be at most ${String(MAX_BIO_LENGTH)} characters`);

export const pronounsSchema = z
  .string()
  .max(MAX_PRONOUNS_LENGTH, `Pronouns must be at most ${String(MAX_PRONOUNS_LENGTH)} characters`);

export const statusEmojiSchema = z
  .string()
  .max(
    MAX_STATUS_EMOJI_LENGTH,
    `Status emoji must be at most ${String(MAX_STATUS_EMOJI_LENGTH)} characters`,
  );

export const serverNameSchema = z
  .string()
  .min(1, "Server name is required")
  .max(
    MAX_SERVER_NAME_LENGTH,
    `Server name must be at most ${String(MAX_SERVER_NAME_LENGTH)} characters`,
  );

export const serverDescriptionSchema = z
  .string()
  .max(
    MAX_SERVER_DESCRIPTION_LENGTH,
    `Server description must be at most ${String(MAX_SERVER_DESCRIPTION_LENGTH)} characters`,
  );

export const channelNameSchema = z
  .string()
  .min(1, "Channel name is required")
  .max(
    MAX_CHANNEL_NAME_LENGTH,
    `Channel name must be at most ${String(MAX_CHANNEL_NAME_LENGTH)} characters`,
  );

export const channelTopicSchema = z
  .string()
  .max(
    MAX_CHANNEL_TOPIC_LENGTH,
    `Channel topic must be at most ${String(MAX_CHANNEL_TOPIC_LENGTH)} characters`,
  );

export const channelTypeSchema = z.enum(["text", "voice"]);

export const messageContentSchema = z
  .string()
  .min(1, "Message cannot be empty")
  .max(MAX_MESSAGE_LENGTH, `Message must be at most ${String(MAX_MESSAGE_LENGTH)} characters`);

export const paginationLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_MESSAGE_LIMIT)
  .default(50);
