import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

const DEFAULT_DB_URL = "postgresql://hearth:hearth@localhost:5432/hearth";

const connectionString = process.env.DATABASE_URL ?? DEFAULT_DB_URL;

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export type Database = typeof db;
