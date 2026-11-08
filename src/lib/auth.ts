import NextAuth, { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { obterSegredoAuth } from "@/lib/authSecret";
import { aplicarConvitePendente, normalizarEmail } from "@/modules/usuarios/convites";

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    contaId?: string | null;
    roleCheckedAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e senha são obrigatórios");
        }

        const user = await prisma.user.findFirst({
          where: { email: { equals: normalizarEmail(credentials.email as string), mode: "insensitive" } },
        });

        if (!user) {
          throw new Error("Nenhum usuário encontrado com este e-mail");
        }
        if (!user.password) throw new Error("Conta registrada via OAuth");

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.password as string
        );

        if (!isValidPassword) {
          throw new Error("Senha inválida");
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const ROLE_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;

        let dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, role: true, contaId: true },
        });

        if (!dbUser && user.email) {
          dbUser = await prisma.user.findFirst({
            where: { email: { equals: normalizarEmail(user.email), mode: "insensitive" } },
            select: { id: true, role: true, contaId: true },
          });
        }

        if (!dbUser && user.email) {
          dbUser = await prisma.user.create({
            data: { id: user.id, email: normalizarEmail(user.email), name: user.name || "Usuário", image: user.image },
            select: { id: true, role: true, contaId: true },
          });
        }

        if (dbUser && !dbUser.contaId) {
          const convite = await aplicarConvitePendente(dbUser.id, user.email).catch((error: unknown) => {
            console.error("[AUTH] Falha ao aplicar convite pendente:", error);
            return null;
          });
          if (convite) dbUser = { ...dbUser, role: convite.role, contaId: convite.contaId };
        }

        token.id = dbUser?.id ?? user.id;
        token.role = dbUser?.role ?? "ADMIN";
        token.contaId = dbUser?.contaId ?? null;
        token.roleCheckedAt = Date.now();
      } else if (
        token.id &&
        (!token.roleCheckedAt || Date.now() - token.roleCheckedAt > ROLE_RECHECK_INTERVAL_MS)
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, contaId: true },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.contaId = dbUser.contaId;
        }
        token.roleCheckedAt = Date.now();
      }

      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.image = session.image;
      }

      return token;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const destino = new URL(url);
        const base = new URL(baseUrl);
        const adminHost = process.env.ADMIN_HOST?.trim().toLowerCase();
        if (destino.origin === base.origin) return url;
        if (adminHost && destino.hostname.toLowerCase() === adminHost) return url;
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        name: token.name,
        email: token.email,
        image: token.image as string | null | undefined,
        role: token.role ?? "ADMIN",
        contaId: token.contaId ?? (token.id as string),
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  ...(process.env.AUTH_COOKIE_DOMAIN
    ? {
        cookies: {
          sessionToken: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
            options: {
              httpOnly: true,
              sameSite: "lax" as const,
              path: "/",
              secure: process.env.NODE_ENV === "production",
              domain: process.env.AUTH_COOKIE_DOMAIN,
            },
          },
        },
      }
    : {}),
  secret: obterSegredoAuth(),
};

export default NextAuth(authOptions);
