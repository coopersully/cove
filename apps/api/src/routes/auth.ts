import crypto from "node:crypto";
import {
  consumePasswordResetToken,
  generateAccessToken,
  generatePasswordResetToken,
  generateRefreshToken,
  hashPassword,
  revokeAllRefreshTokens,
  rotateRefreshToken,
  validatePasswordResetToken,
  verifyPassword,
} from "@cove/auth";

import { db, refreshTokens, users } from "@cove/db";
import {
  AppError,
  emailSchema,
  generateSnowflake,
  passwordSchema,
  usernameSchema,
} from "@cove/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { sendPasswordResetEmail } from "../lib/index.js";
import { validate } from "../middleware/index.js";

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const validateResetTokenSchema = z.object({
  token: z.string().min(1),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const authRoutes = new Hono();

// GET /auth/check-availability
authRoutes.get("/check-availability", async (c) => {
  const username = c.req.query("username");

  if (!username) {
    throw new AppError("VALIDATION_ERROR", "Username query parameter is required");
  }

  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid username");
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data))
    .limit(1);

  return c.json({ available: !existing });
});

// POST /auth/register
authRoutes.post("/register", validate(registerSchema), async (c) => {
  const body = c.get("body");

  // Check uniqueness
  const [existingUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, body.username))
    .limit(1);

  if (existingUsername) {
    throw new AppError("CONFLICT", "Username already taken");
  }

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existingEmail) {
    throw new AppError("CONFLICT", "Email already in use");
  }

  const passwordHash = await hashPassword(body.password);
  const id = generateSnowflake();

  const [user] = await db
    .insert(users)
    .values({
      id: BigInt(id),
      username: body.username,
      email: body.email,
      passwordHash,
    })
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      status: users.status,
      bio: users.bio,
      pronouns: users.pronouns,
      statusEmoji: users.statusEmoji,
      createdAt: users.createdAt,
    });

  if (!user) {
    throw new AppError("INTERNAL_ERROR", "Failed to create user");
  }

  const accessToken = await generateAccessToken(id, body.username);
  const { token: refreshToken } = await generateRefreshToken(id);

  return c.json(
    {
      user: { ...user, id: String(user.id) },
      accessToken,
      refreshToken,
    },
    201,
  );
});

// POST /auth/login
authRoutes.post("/login", validate(loginSchema), async (c) => {
  const body = c.get("body");

  const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password");
  }

  const valid = await verifyPassword(user.passwordHash, body.password);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password");
  }

  const userId = String(user.id);
  const accessToken = await generateAccessToken(userId, user.username);
  const { token: refreshToken } = await generateRefreshToken(userId);

  return c.json({
    user: {
      id: userId,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      status: user.status,
      bio: user.bio,
      pronouns: user.pronouns,
      statusEmoji: user.statusEmoji,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  });
});

// POST /auth/refresh
authRoutes.post("/refresh", validate(refreshSchema), async (c) => {
  const body = c.get("body");

  const tokenHash = crypto.createHash("sha256").update(body.refreshToken).digest("hex");

  const [existing] = await db
    .select({ userId: refreshTokens.userId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!existing) {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token");
  }

  const userId = String(existing.userId);
  const { token: newRefreshToken } = await rotateRefreshToken(body.refreshToken, userId);

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, existing.userId))
    .limit(1);

  if (!user) {
    throw new AppError("UNAUTHORIZED", "User not found");
  }

  const accessToken = await generateAccessToken(userId, user.username);

  return c.json({
    accessToken,
    refreshToken: newRefreshToken,
  });
});

// POST /auth/forgot-password
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), async (c) => {
  const body = c.get("body");

  // Always return success to prevent email enumeration
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (user) {
    const userId = String(user.id);
    const token = await generatePasswordResetToken(userId);

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:4200";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    // Fire-and-forget: don't block the response or leak errors
    sendPasswordResetEmail(body.email, resetUrl).catch((err) => {
      console.error("[Password Reset] Email send failed:", err);
    });
  }

  return c.json({ success: true as const });
});

// POST /auth/validate-reset-token
authRoutes.post("/validate-reset-token", validate(validateResetTokenSchema), async (c) => {
  const body = c.get("body");
  const valid = await validatePasswordResetToken(body.token);
  return c.json({ valid });
});

// POST /auth/reset-password
authRoutes.post("/reset-password", validate(resetPasswordSchema), async (c) => {
  const body = c.get("body");

  const userId = await consumePasswordResetToken(body.token);
  const passwordHash = await hashPassword(body.password);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, BigInt(userId)));

  // Revoke all existing sessions
  await revokeAllRefreshTokens(userId);

  return c.json({ success: true as const });
});
