import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config (no DB, no bcrypt). Used by middleware so it can run
 * on the edge runtime. The full config (with the Credentials provider) lives in
 * ./auth.ts.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.clientId = user.clientId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "sakneen_admin" | "client_user";
      session.user.clientId = token.clientId as string | null;
      return session;
    },
  },
} satisfies NextAuthConfig;
