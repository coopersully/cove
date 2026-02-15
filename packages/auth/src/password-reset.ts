import crypto from "node:crypto";

import { db, passwordResetTokens, refreshTokens } from "@hearth/db";
import { AppError, generateSnowflake } from "@hearth/shared";
import { and, eq, isNull } from "drizzle-orm";

import { hashToken } from "./tokens.js";

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function generatePasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await db.insert(passwordResetTokens).values({
    id: BigInt(generateSnowflake()),
    userId: BigInt(userId),
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string> {
  const tokenHash = hashToken(token);

  const [existing] = await db
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId, expiresAt: passwordResetTokens.expiresAt })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired reset token");
  }

  if (existing.expiresAt < new Date()) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired reset token");
  }

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, existing.id));

  return String(existing.userId);
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, BigInt(userId)),
        isNull(refreshTokens.revokedAt),
      ),
    );
}
