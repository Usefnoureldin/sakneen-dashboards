import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

// Load .env.local for local dev. override: false means real process.env wins,
// so `railway run` (which injects prod env) connects to the prod DB, not local.
config({ path: ".env.local", override: false });

import { clients, users } from "../src/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema: { clients, users } });

type SeedUser = {
  email: string;
  name: string;
  role: "sakneen_admin" | "client_user";
  clientSlug: string | null;
};

const SEED_USERS: SeedUser[] = [
  // Sakneen admins
  { email: "youssef@sakneen.com", name: "Youssef Noureldin", role: "sakneen_admin", clientSlug: null },
  { email: "nadia@sakneen.com", name: "Nadia", role: "sakneen_admin", clientSlug: null },
  // Paragon Adeer
  { email: "fouad.harraz@paragonadeer.com", name: "Fouad Harraz", role: "client_user", clientSlug: "paragonadeer" },
  { email: "eslam.abdelazim@paragonadeer.com", name: "Eslam Abdelazim", role: "client_user", clientSlug: "paragonadeer" },
  { email: "omar.nasser@paragonadeer.com", name: "Omar Nasser", role: "client_user", clientSlug: "paragonadeer" },
  { email: "sara.robel@weareparagon.dev", name: "Sara Robel", role: "client_user", clientSlug: "paragonadeer" },
];

function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

async function ensureClient(slug: string, name: string, displayName: string) {
  const [existing] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  if (existing) {
    console.log(`= client: ${existing.name} (${existing.id}) already seeded`);
    return existing;
  }
  const [created] = await db
    .insert(clients)
    .values({ slug, name, displayName, active: true })
    .returning();
  console.log(`+ client: ${created.name} (${created.id})`);
  return created;
}

async function ensureUser(u: SeedUser, clientId: string | null) {
  const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
  if (existing) {
    console.log(`= user:   ${existing.email.padEnd(36)} (${existing.role}) already seeded`);
    return { user: existing, generatedPassword: null as string | null };
  }
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({
      email: u.email,
      passwordHash,
      name: u.name,
      role: u.role,
      clientId,
    })
    .returning();
  console.log(`+ user:   ${created.email.padEnd(36)} (${created.role})`);
  return { user: created, generatedPassword: password };
}

async function main() {
  const paragon = await ensureClient("paragonadeer", "Paragon Adeer", "Paragon Adeer");

  const slugToId = new Map<string, string>([[paragon.slug, paragon.id]]);

  const generated: { email: string; password: string }[] = [];
  for (const u of SEED_USERS) {
    const clientId = u.clientSlug ? slugToId.get(u.clientSlug) ?? null : null;
    if (u.clientSlug && !clientId) {
      throw new Error(`Unknown clientSlug ${u.clientSlug} for ${u.email}`);
    }
    const result = await ensureUser(u, clientId);
    if (result.generatedPassword) {
      generated.push({ email: u.email, password: result.generatedPassword });
    }
  }

  if (generated.length > 0) {
    console.log("");
    console.log("Generated temp passwords (share out-of-band, change after first login):");
    console.log("");
    for (const g of generated) {
      console.log(`  ${g.email.padEnd(36)}  ${g.password}`);
    }
    console.log("");
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
