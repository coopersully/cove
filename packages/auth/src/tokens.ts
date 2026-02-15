import crypto from "node:crypto";

import { db, refreshTokens } from "@hearth/db";
import { AppError, generateSnowflake } from "@hearth/shared";
import { and, eq, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

export function generateAccessToken(userId: string, username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      sub: payload.sub as string,
      username: payload.username as string,
    };
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid or expired access token");
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function generateRefreshToken(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await db.insert(refreshTokens).values({
    id: BigInt(generateSnowflake()),
    userId: BigInt(userId),
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function rotateRefreshToken(
  oldToken: string,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const oldHash = hashToken(oldToken);

  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, oldHash),
        eq(refreshTokens.userId, BigInt(userId)),
        isNull(refreshTokens.revokedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token");
  }

  if (existing.expiresAt < new Date()) {
    throw new AppError("UNAUTHORIZED", "Refresh token has expired");
  }

  // Revoke old token
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, existing.id));

  // Issue new token
  return generateRefreshToken(userId);
}
