import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

config({ path: ".env.local", override: true });

import { clients, users } from "../src/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema: { clients, users } });

async function main() {
  const paragonSlug = "paragonadeer";
  const youssefEmail = "youssef@sakneen.com";

  let paragon = (await db.select().from(clients).where(eq(clients.slug, paragonSlug)))[0];
  if (!paragon) {
    [paragon] = await db
      .insert(clients)
      .values({
        slug: paragonSlug,
        name: "Paragon Adeer",
        displayName: "Paragon Adeer",
        active: true,
      })
      .returning();
    console.log(`+ client: ${paragon.name} (${paragon.id})`);
  } else {
    console.log(`= client: ${paragon.name} (${paragon.id}) already seeded`);
  }

  const existing = (await db.select().from(users).where(eq(users.email, youssefEmail)))[0];
  if (existing) {
    console.log(`= user:   ${existing.email} already seeded`);
  } else {
    const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);
    const [u] = await db
      .insert(users)
      .values({
        email: youssefEmail,
        passwordHash,
        name: "Youssef Noureldin",
        role: "sakneen_admin",
        clientId: null,
      })
      .returning();
    console.log(`+ user:   ${u.email} (sakneen_admin)`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log("");
      console.log("  Generated temp password (change after first login):");
      console.log(`    ${password}`);
      console.log("");
    }
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
