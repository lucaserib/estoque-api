import NextAuth, { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { obterSegredoAuth } from "@/lib/authSecret";
import { aplicarConvitePendente, normalizarEmail } from "@/modules/usuarios/convites";
import { checkRateLimit } from "@/lib/rateLimit";
import { aoCriarConta } from "@/modules/conta/criacao";
import { avisarConviteAceito } from "@/modules/usuarios/equipe";
import { sessaoAindaValida } from "@/helpers/verifyUser";

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    contaId?: string | null;
    roleCheckedAt?: number;
    emitidoEm?: number;
    emailVerificado?: boolean;
  }
}

export const MENSAGEM_LOGIN_INVALIDO = "E-mail ou senha inválidos";
export const MENSAGEM_MUITAS_TENTATIVAS = "Muitas tentativas de entrar. Aguarde alguns minutos e tente de novo.";
export const MENSAGEM_USUARIO_BLOQUEADO = "O acesso deste usuário está bloqueado. Fale com o suporte.";
const HASH_FALSO = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.Hf2b1Xx6E6xvO3n5r8w2b8bHqQ7W";

function ipDaRequisicao(cabecalhos: Record<string, unknown> | undefined): string {
  const encaminhado = cabecalhos?.["x-forwarded-for"];
  const valor = Array.isArray(encaminhado) ? encaminhado[0] : encaminhado;
  return typeof valor === "string" && valor.trim() ? valor.split(",")[0].trim() : "local";
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
      authorize: async (credentials, req) => {
        if (!credentials?.email || !credentials?.password) {
          throw new Error(MENSAGEM_LOGIN_INVALIDO);
        }

        const email = normalizarEmail(credentials.email as string);
        const limite = await checkRateLimit("login", `${ipDaRequisicao(req?.headers)}:${email}`, 10, 900);
        if (!limite.allowed) throw new Error(MENSAGEM_MUITAS_TENTATIVAS);

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        const senhaConfere = user?.password
          ? await bcrypt.compare(credentials.password as string, user.password)
          : await bcrypt.compare(credentials.password as string, HASH_FALSO).then(() => false);

        if (!user || !senhaConfere) throw new Error(MENSAGEM_LOGIN_INVALIDO);
        if (user.bloqueadoEm) throw new Error(MENSAGEM_USUARIO_BLOQUEADO);

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
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;
      const existente = await prisma.user.findFirst({
        where: { email: { equals: normalizarEmail(user.email), mode: "insensitive" } },
        select: { bloqueadoEm: true },
      });
      return !existente?.bloqueadoEm;
    },
    async jwt({ token, user, account, trigger, session }) {
      const ROLE_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;

        const selecao = { id: true, role: true, contaId: true, emailVerificadoEm: true } as const;
        const viaGoogle = account?.provider === "google";
        let novoUsuario = false;

        let dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: selecao });

        if (!dbUser && user.email) {
          dbUser = await prisma.user.findFirst({
            where: { email: { equals: normalizarEmail(user.email), mode: "insensitive" } },
            select: selecao,
          });
        }

        if (!dbUser && user.email) {
          dbUser = await prisma.user.create({
            data: {
              id: user.id,
              email: normalizarEmail(user.email),
              name: user.name || "Usuário",
              image: user.image,
              emailVerificadoEm: new Date(),
            },
            select: selecao,
          });
          novoUsuario = true;
        }

        if (dbUser && viaGoogle && !dbUser.emailVerificadoEm) {
          await prisma.user
            .update({ where: { id: dbUser.id }, data: { emailVerificadoEm: new Date() } })
            .catch((error: unknown) => console.error("[AUTH] Falha ao marcar e-mail verificado:", error));
        }

        if (dbUser && !dbUser.contaId) {
          const convite = await aplicarConvitePendente(dbUser.id, user.email).catch((error: unknown) => {
            console.error("[AUTH] Falha ao aplicar convite pendente:", error);
            return null;
          });
          if (convite) {
            dbUser = { ...dbUser, role: convite.role, contaId: convite.contaId };
            await avisarConviteAceito(convite.conviteId, dbUser.id);
          }
        }

        if (dbUser && novoUsuario) await aoCriarConta(dbUser.id, dbUser.contaId, "google");

        token.id = dbUser?.id ?? user.id;
        token.role = dbUser?.role ?? "ADMIN";
        token.contaId = dbUser?.contaId ?? null;
        token.roleCheckedAt = Date.now();
        token.emitidoEm = Date.now();
        if (dbUser) {
          await prisma.user
            .update({ where: { id: dbUser.id }, data: { ultimoLoginEm: new Date() } })
            .catch((error: unknown) => console.error("[AUTH] Falha ao gravar o último login:", error));
        }
        token.emailVerificado = Boolean(dbUser?.emailVerificadoEm) || viaGoogle;
      } else if (
        token.id &&
        (!token.roleCheckedAt || Date.now() - token.roleCheckedAt > ROLE_RECHECK_INTERVAL_MS)
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, contaId: true, bloqueadoEm: true, sessaoValidaDesde: true, emailVerificadoEm: true },
        });

        if (!dbUser || dbUser.bloqueadoEm || !sessaoAindaValida(token.emitidoEm, dbUser.sessaoValidaDesde)) {
          return {};
        }

        token.role = dbUser.role;
        token.contaId = dbUser.contaId;
        token.emailVerificado = Boolean(dbUser.emailVerificadoEm);
        token.roleCheckedAt = Date.now();
      }

      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.image = session.image;
        if (session.recarregar && token.id) {
          const atual = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { emailVerificadoEm: true, role: true, contaId: true },
          });
          if (atual) {
            token.emailVerificado = Boolean(atual.emailVerificadoEm);
            token.role = atual.role;
            token.contaId = atual.contaId;
          }
        }
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
        emailVerificado: token.emailVerificado ?? true,
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
