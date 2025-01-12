import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const session = await auth();

  // Obter a URL requisitada
  const { pathname } = req.nextUrl;

  // Permitir acesso às rotas públicas (login e register)
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.next();
  }

  // Redirecionar se o usuário não estiver autenticado
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// Define as rotas que o middleware protege
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"], // Protege todas as rotas exceto as estáticas e API
};
