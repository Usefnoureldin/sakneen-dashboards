/**
 * Sync user password_hash from secrets/passwords.json into whatever DB the
 * current DATABASE_URL points to.
 *
 * Local:  pnpm db:set-passwords
 * Prod:   DATABASE_URL=$(railway variables --service Postgres --kv \
 *           | grep DATABASE_PUBLIC_URL | cut -d= -f2-) pnpm db:set-passwords
 *
 * Idempotent: re-running with the same passwords is a no-op (re-hashes but
 * yields functionally equivalent state).
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

config({ path: ".env.local", override: false });

import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/passwords";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const passwordsPath = path.resolve("secrets/passwords.json");
if (!existsSync(passwordsPath)) {
  console.error(`Missing ${passwordsPath}. Create it from secrets/PASSWORDS.md.`);
  process.exit(1);
}

const passwordMap: Record<string, string> = JSON.parse(readFileSync(passwordsPath, "utf8"));

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

async function main() {
  const target = new URL(process.env.DATABASE_URL!).host;
  console.log(`syncing ${Object.keys(passwordMap).length} passwords → ${target}`);

  let updated = 0;
  let missing = 0;
  for (const [email, password] of Object.entries(passwordMap)) {
    const hash = await hashPassword(password);
    const result = await db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.email, email))
      .returning({ id: users.id });
    if (result.length === 0) {
      console.log(`? ${email.padEnd(36)} not in this DB (skipped)`);
      missing++;
    } else {
      console.log(`✓ ${email.padEnd(36)} updated`);
      updated++;
    }
  }
  console.log(`\n${updated} updated, ${missing} missing`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
