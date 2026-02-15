import { defineConfig } from "drizzle-kit";

const DEFAULT_DB_HOST = "localhost";
const DEFAULT_DB_PORT = "5433";
const DEFAULT_DB_NAME = "cove";
const DEFAULT_DB_USER = "cove";
const DEFAULT_DB_URL = `postgresql://${DEFAULT_DB_USER}:${DEFAULT_DB_USER}@${DEFAULT_DB_HOST}:${DEFAULT_DB_PORT}/${DEFAULT_DB_NAME}`;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? DEFAULT_DB_URL,
  },
});
