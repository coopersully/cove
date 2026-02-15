import { z } from "zod";

import {
  channelNameSchema,
  channelTopicSchema,
  channelTypeSchema,
  displayNameSchema,
  emailSchema,
  passwordSchema,
  serverDescriptionSchema,
  serverNameSchema,
  snowflakeSchema,
  statusSchema,
  usernameSchema,
} from "./validators.js";

// ── Auth Schemas ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ── Server Schemas ──────────────────────────────────────────────────────────

export const createServerSchema = z.object({
  name: serverNameSchema,
  description: serverDescriptionSchema.optional(),
});

export const joinServerSchema = z.object({
  serverId: snowflakeSchema,
});

export const serverSettingsSchema = z.object({
  name: serverNameSchema,
  description: serverDescriptionSchema.optional(),
});

// ── Channel Schemas ─────────────────────────────────────────────────────────

export const createChannelSchema = z.object({
  name: channelNameSchema,
  type: channelTypeSchema,
});

export const editChannelSchema = z.object({
  name: channelNameSchema,
  topic: channelTopicSchema.optional(),
});

// ── User Schemas ────────────────────────────────────────────────────────────

export const editProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  status: statusSchema.optional(),
});
