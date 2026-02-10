import { db, users } from "@hearth/db";
import { AppError } from "@hearth/shared";
import { eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";

import { verifyAccessToken } from "./tokens.js";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

export function requireAuth(): MiddlewareHandler<AuthEnv> {
  return async (c, next): Promise<void> => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHORIZED", "Missing or invalid Authorization header");
    }

    const token = header.slice(7);
    const payload = await verifyAccessToken(token);

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, BigInt(payload.sub)))
      .limit(1);

    if (!user) {
      throw new AppError("UNAUTHORIZED", "User not found");
    }

    c.set("user", {
      ...user,
      id: String(user.id),
    });

    await next();
  };
}

// biome-ignore lint/suspicious/noExplicitAny: Hono context generics vary per route
export function getUser(c: Context<any>): AuthUser {
  return c.get("user") as AuthUser;
}
