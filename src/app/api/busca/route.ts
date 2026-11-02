import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

const LIMITE_POR_TIPO = 8;

interface ResultadoBusca {
  tipo: "produto" | "pedido" | "anuncio";
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return NextResponse.json({ resultados: [] });
    }

    const comoNumero = Number(q);
    const ehNumero = Number.isInteger(comoNumero) && q === String(comoNumero);

    const [produtos, pedidos, anuncios] = await Promise.all([
      prisma.produto.findMany({
        where: {
          userId: user.contaId,
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            ...(ehNumero ? [{ ean: BigInt(comoNumero) }] : []),
          ],
        },
        select: { id: true, nome: true, sku: true },
        take: LIMITE_POR_TIPO,
        orderBy: { nome: "asc" },
      }),
      ehNumero
        ? prisma.pedidoCompra.findMany({
            where: { userId: user.contaId, id: comoNumero },
            select: { id: true, status: true, fornecedor: { select: { nome: true } } },
            take: LIMITE_POR_TIPO,
          })
        : Promise.resolve([]),
      prisma.produtoMercadoLivre.findMany({
        where: {
          mercadoLivreAccount: { userId: user.contaId },
          OR: [
            { mlTitle: { contains: q, mode: "insensitive" } },
            { mlItemId: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, mlItemId: true, mlTitle: true },
        take: LIMITE_POR_TIPO,
        orderBy: { mlTitle: "asc" },
      }),
    ]);

    const resultados: ResultadoBusca[] = [
      ...produtos.map((p): ResultadoBusca => ({
        tipo: "produto",
        id: p.id,
        titulo: p.nome,
        subtitulo: p.sku,
        href: `/produtos/${p.id}`,
      })),
      ...pedidos.map((pedido): ResultadoBusca => ({
        tipo: "pedido",
        id: String(pedido.id),
        titulo: `Pedido #${pedido.id}`,
        subtitulo: `${pedido.fornecedor.nome} · ${pedido.status}`,
        href: `/gestao-pedidos?pedido=${pedido.id}`,
      })),
      ...anuncios.map((a): ResultadoBusca => ({
        tipo: "anuncio",
        id: a.id,
        titulo: a.mlTitle,
        subtitulo: a.mlItemId,
        href: `/mercado-livre/produtos?q=${encodeURIComponent(a.mlItemId)}`,
      })),
    ];

    return NextResponse.json({ resultados });
  } catch (error) {
    console.error("Erro ao buscar:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
