import { NextRequest, NextResponse } from "next/server";
import { COOKIE_ORIGEM, DIAS_COOKIE_ORIGEM, lerOrigem, origemDaUrl, serializarOrigem } from "@/lib/origemCadastro";
import { normalizarCodigoIndicacao } from "@/modules/clientes/perfil";

export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = normalizarCodigoIndicacao((await params).codigo);
  const destino = new URL("/register", request.url);
  if (!codigo) return NextResponse.redirect(destino);

  destino.searchParams.set("ref", codigo);
  for (const parametro of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const valor = request.nextUrl.searchParams.get(parametro);
    if (valor) destino.searchParams.set(parametro, valor);
  }

  const atual = lerOrigem(request.cookies.get(COOKIE_ORIGEM)?.value);
  const origem = atual ?? origemDaUrl(request.nextUrl, request.headers.get("referer"));
  origem.ref = codigo;

  const resposta = NextResponse.redirect(destino);
  resposta.cookies.set(COOKIE_ORIGEM, serializarOrigem(origem), {
    maxAge: DIAS_COOKIE_ORIGEM * 86400,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return resposta;
}
