import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { getTenantSlug } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/rate-limit";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/api/auth", "/print", "/api/health"];

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const session = req.auth;
  const role = session?.user?.role;

  const slug = getTenantSlug(req.headers.get("host"));

  // Pass tenant slug down to handlers/server components.
  const requestHeaders = new Headers(req.headers);
  if (slug) requestHeaders.set("x-tenant-slug", slug);

  // Rate limit credential-login posts before anything else.
  if (path === "/api/auth/callback/credentials" && req.method === "POST") {
    const ip = clientIp(req);
    const rl = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again in a few minutes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          },
        },
      );
    }
  }

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (isPublic) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  if (path.startsWith("/admin") && role !== "sakneen_admin") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (path.startsWith("/dashboard")) {
    if (role !== "client_user") {
      return NextResponse.redirect(new URL("/admin", nextUrl));
    }
    // Tenant URL guard: subdomain slug must match the user's client_id (looked up server-side later).
    // For now the slug presence is informational; the page-level loader does the actual client_id check.
  }

  if (path === "/") {
    if (role === "sakneen_admin") return NextResponse.redirect(new URL("/admin", nextUrl));
    if (role === "client_user") return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    // Run on everything except static assets and image optimizations.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
