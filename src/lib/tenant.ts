/**
 * Tenant resolution from the request host.
 *
 * - Production: `<slug>.sakneen.com` → slug is the leftmost label
 * - Local dev: `<slug>.127.0.0.1.nip.io:3000` → slug is the leftmost label
 * - Apex (admin entry): `localhost:3000`, `127.0.0.1.nip.io:3000`,
 *   `dashboards.sakneen.com`, `sakneen.com` → returns null
 *
 * Slug shape: lowercase letters and digits only. Anything else returns null
 * to avoid treating words like `www`, `api`, `dashboards` as tenants.
 */

const APEX_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "127.0.0.1.nip.io",
  "sakneen.com",
  "dashboards.sakneen.com",
  "eoi.sakneen.com",
]);

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "dashboards",
  "app",
  "eoi",
  // Railway preview/runtime hosts; never treated as a tenant slug.
  "up",
]);

const SLUG_PATTERN = /^[a-z0-9]+$/;

export function getTenantSlug(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  if (APEX_HOSTS.has(hostname)) return null;
  // Railway internal hostnames look like <service>-<env>.up.railway.app — not tenants.
  if (hostname.endsWith(".up.railway.app") || hostname.endsWith(".railway.app")) return null;

  const parts = hostname.split(".");
  if (parts.length < 2) return null;

  const candidate = parts[0];
  if (RESERVED_SUBDOMAINS.has(candidate)) return null;
  if (!SLUG_PATTERN.test(candidate)) return null;

  return candidate;
}
