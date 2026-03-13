import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
type Role = "MAIN_APZ_ADMIN" | "ZAVUCH" | "CLASS_TEACHER";

type AppUserClaims = {
  role: Role;
  schoolId: string | null;
  isApproved?: boolean | null;
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            role: true,
            schoolId: true,
            isApproved: true,
            deletedAt: true,
          },
        });

        if (!user) throw new Error("USER_NOT_FOUND");
        if (user.deletedAt) throw new Error("USER_DELETED");
        if (!user.password) throw new Error("INVALID_PASSWORD");
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) throw new Error("INVALID_PASSWORD");

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          isApproved: user.isApproved,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        const claims = user as unknown as Partial<AppUserClaims>;
        token.role = claims.role;
        token.schoolId = claims.schoolId;
        token.isApproved = typeof claims.isApproved === "boolean" ? claims.isApproved : null;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token?.sub) session.user.id = token.sub;
      session.user.role = (token.role as Role | undefined) ?? undefined;
      session.user.schoolId =
        typeof token.schoolId === "string" ? token.schoolId : null;
      session.user.isApproved =
        typeof token.isApproved === "boolean" ? token.isApproved : null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
