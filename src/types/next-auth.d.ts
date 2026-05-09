import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "sakneen_admin" | "client_user";
      clientId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: "sakneen_admin" | "client_user";
    clientId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "sakneen_admin" | "client_user";
    clientId: string | null;
  }
}
