import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";

const LIMITE_POR_TIPO = 8;

interface ResultadoBusca {
  tipo: "produto" | "pedido" | "anuncio" | "tarefa";
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return NextResponse.json({ resultados: [] });
    }

    const comoNumero = Number(q);
    const ehNumero = Number.isInteger(comoNumero) && q === String(comoNumero);
    const numeroTarefa = /^#(\d{1,9})$/.exec(q);

    const [produtos, pedidos, anuncios, tarefas] = await Promise.all([
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
      prisma.tarefa.findMany({
        where: {
          contaId: user.contaId,
          arquivadaEm: null,
          OR: numeroTarefa ? [{ numero: Number(numeroTarefa[1]) }] : [{ titulo: { contains: q, mode: "insensitive" } }],
        },
        select: { id: true, numero: true, titulo: true, concluidaEm: true },
        orderBy: [{ concluidaEm: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
        take: LIMITE_POR_TIPO,
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
      ...tarefas.map((t): ResultadoBusca => ({
        tipo: "tarefa",
        id: t.id,
        titulo: t.titulo,
        subtitulo: `Tarefa #${t.numero}${t.concluidaEm ? " · concluída" : ""}`,
        href: `/operacao?tarefa=${t.id}`,
      })),
    ];

    return NextResponse.json({ resultados });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao buscar:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
