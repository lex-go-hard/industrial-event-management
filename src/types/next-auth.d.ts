import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      schoolId?: string | null;
      isApproved?: boolean | null;
    } & DefaultSession["user"];
  }
}

