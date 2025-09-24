import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  // ✅ CORREÇÃO: Configurar token com secureCookie baseado no protocolo
  const isSecure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecure,
    cookieName: isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token"
  });

  const { pathname } = req.nextUrl;

  // Verificar se é um callback do Mercado Livre (tem parâmetros code ou error)
  const isMLCallback =
    req.nextUrl.searchParams.has("code") ||
    req.nextUrl.searchParams.has("error");

  // Verificar se está vindo do ngrok
  const isFromNgrok =
    req.headers.get("host")?.includes(".ngrok") ||
    req.headers.get("host")?.includes(".ngrok.io") ||
    req.headers.get("host")?.includes(".ngrok-free.app");

  console.log("🔍 Middleware:", {
    pathname,
    isMLCallback,
    isFromNgrok,
    hasToken: !!token,
    host: req.headers.get("host"),
  });

  // Permitir acesso às rotas públicas
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.next();
  }

  // Permitir callback do ML vindos do ngrok (mesmo sem token, pois será processado no frontend)
  if (isMLCallback && isFromNgrok && pathname === "/configuracoes") {
    console.log("✅ Permitindo callback ML do ngrok");
    return NextResponse.next();
  }

  // ✅ CORREÇÃO: Para ngrok, tentar também com cookie padrão se não encontrou o seguro
  if (!token && isFromNgrok) {
    const fallbackToken = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: false,
      cookieName: "next-auth.session-token"
    });

    if (fallbackToken) {
      // Token encontrado no cookie não-seguro, permitir acesso
      console.log("✅ Token encontrado via fallback para ngrok");

      const requestHeaders = new Headers(req.headers);
      if (fallbackToken?.id) {
        requestHeaders.set("x-user-id", fallbackToken.id as string);
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  }

  // Redirecionar se o usuário não estiver autenticado
  if (!token) {
    console.log("❌ Token não encontrado, redirecionando para login");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const requestHeaders = new Headers(req.headers);
  if (token?.id) {
    requestHeaders.set("x-user-id", token.id as string);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"], // Protege todas as rotas exceto estáticas e APIs
};
