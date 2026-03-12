import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
type Role = "ADMIN" | "DEPARTMENT_HEAD" | "EMPLOYEE";

type AppUserClaims = {
  role: Role;
  departmentId: string | null;
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
            passwordHash: true,
            role: true,
            departmentId: true,
          },
        });

        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
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
        token.departmentId = claims.departmentId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token?.sub) session.user.id = token.sub;
      session.user.role = (token.role as Role | undefined) ?? undefined;
      session.user.departmentId =
        typeof token.departmentId === "string" ? token.departmentId : null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
