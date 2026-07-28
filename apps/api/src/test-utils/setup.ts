import { db } from "@cove/db";
import { sql } from "drizzle-orm";
import { afterEach, beforeAll } from "vitest";

const tableNames = [
  "embeds",
  "attachments",
  "reactions",
  "friendships",
  "dm_members",
  "messages",
  "invite_codes",
  "password_reset_tokens",
  "refresh_tokens",
  "roles",
  "custom_emojis",
  "server_members",
  "channels",
  "servers",
  "users",
];

beforeAll(async () => {
  // Verify test DB connection works
  await db.execute(sql`SELECT 1`);
});

afterEach(async () => {
  // Truncate all tables between tests for isolation
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames.join(", ")} CASCADE`));
});
