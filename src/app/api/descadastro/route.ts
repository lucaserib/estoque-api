import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preferenciasDoUsuario } from "@/modules/clientes/consentimento";
import { aplicarDescadastro, escolhasDoToken, lerTokenDescadastro } from "@/modules/email/descadastro";

const escolhasSchema = z.object({
  t: z.string().min(10).max(500),
  cicloDeVida: z.boolean().optional(),
  marketing: z.boolean().optional(),
  consultar: z.boolean().optional(),
});

function contexto(request: NextRequest) {
  return {
    origem: "descadastro" as const,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

function mascarar(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return email;
  return `${usuario.slice(0, 2)}${"*".repeat(Math.max(1, usuario.length - 2))}@${dominio}`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/descadastro?t=${encodeURIComponent(token)}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const tipo = request.headers.get("content-type") ?? "";

  if (!tipo.includes("application/json")) {
    const lido = lerTokenDescadastro(request.nextUrl.searchParams.get("t"));
    if (!lido) return NextResponse.json({ error: "Link de descadastro inválido" }, { status: 400 });
    await aplicarDescadastro(lido.userId, escolhasDoToken(lido.categoria), contexto(request));
    return new NextResponse("Descadastro feito.", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const corpo = escolhasSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const lido = lerTokenDescadastro(corpo.data.t);
  if (!lido) return NextResponse.json({ error: "Link de descadastro inválido" }, { status: 400 });

  const usuario = await prisma.user.findUnique({ where: { id: lido.userId }, select: { email: true } });
  if (!usuario) return NextResponse.json({ error: "Link de descadastro inválido" }, { status: 400 });

  if (corpo.data.consultar) {
    const preferencias = await preferenciasDoUsuario(lido.userId);
    return NextResponse.json({
      email: mascarar(usuario.email),
      categoria: lido.categoria,
      cicloDeVida: preferencias.cicloDeVida,
      marketing: preferencias.marketingEmail,
    });
  }

  const escolhas =
    corpo.data.cicloDeVida === undefined && corpo.data.marketing === undefined
      ? escolhasDoToken(lido.categoria)
      : { cicloDeVida: corpo.data.cicloDeVida, marketing: corpo.data.marketing };
  const estado = await aplicarDescadastro(lido.userId, escolhas, contexto(request));
  return NextResponse.json({ email: mascarar(usuario.email), categoria: lido.categoria, ...estado });
}
