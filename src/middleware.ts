import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { obterSegredoAuth } from "@/lib/authSecret";

const ROTAS_PUBLICAS = [
  "/login",
  "/register",
  "/esqueci-senha",
  "/redefinir-senha",
  "/confirmar-email",
  "/descadastro",
  "/planos",
  "/termos",
  "/privacidade",
  "/indique/regulamento",
  "/r/",
  "/pesquisa/",
];

function hostDoAdmin(host: string | null): boolean {
  if (!host) return false;
  const configurado = process.env.ADMIN_HOST?.trim().toLowerCase();
  const atual = host.toLowerCase().split(":")[0];
  if (configurado) return atual === configurado;
  return atual.startsWith("admin.");
}

async function lerToken(req: NextRequest) {
  const segura = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const segredo = obterSegredoAuth();
  const token = await getToken({
    req,
    secret: segredo,
    secureCookie: segura,
    cookieName: segura ? "__Secure-next-auth.session-token" : "next-auth.session-token",
  });
  if (token) return token;
  return getToken({
    req,
    secret: segredo,
    secureCookie: !segura,
    cookieName: segura ? "next-auth.session-token" : "__Secure-next-auth.session-token",
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const noHostAdmin = hostDoAdmin(req.headers.get("host"));

  if (ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota))) {
    return NextResponse.next();
  }

  const token = await lerToken(req);

  if (!token?.id) {
    const destino = new URL("/login", req.url);
    if (pathname !== "/") destino.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(destino);
  }

  const cabecalhos = new Headers(req.headers);
  if (token.id) cabecalhos.set("x-user-id", token.id as string);

  if (noHostAdmin && !pathname.startsWith("/admin")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.rewrite(url, { request: { headers: cabecalhos } });
  }

  return NextResponse.next({ request: { headers: cabecalhos } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|manifest.webmanifest|.*\\.[a-zA-Z0-9]+$).*)"],
};
