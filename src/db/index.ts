import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// During `next build`, page-data collection imports server modules (even dynamic ones).
// We must not throw at module load — we'd fail the build. The placeholder URL never
// connects because no queries run at build time. At runtime, missing DATABASE_URL
// fails loudly on first query.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
if (!process.env.DATABASE_URL && !isBuild) {
  throw new Error("DATABASE_URL is not set");
}

const databaseUrl =
  process.env.DATABASE_URL || "postgres://buildtime:placeholder@localhost:5432/buildtime";

const client = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export { schema };
