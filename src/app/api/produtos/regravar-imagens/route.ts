import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";
import { rehostTemporaryImage } from "@/lib/blingImageHost";
import { permissaoErrorResponse } from "@/lib/permissoes";

export const maxDuration = 45;

const TAMANHO_PAGINA = 100;

interface RequestBody {
  cursor?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem regravar imagens" }, { status: 403 });
    }

    const body: RequestBody = await request.json().catch(() => ({}));

    const produtos = await prisma.produto.findMany({
      where: {
        userId: user.contaId,
        imagemUrl: { not: null },
        ...(body.cursor ? { id: { gt: body.cursor } } : {}),
      },
      select: { id: true, sku: true, imagemUrl: true },
      orderBy: { id: "asc" },
      take: TAMANHO_PAGINA,
    });

    let regravados = 0;
    let erros = 0;
    let examinados = 0;

    for (const produto of produtos) {
      examinados++;
      if (!produto.imagemUrl || !BlingService.pareceUrlAssinada(produto.imagemUrl)) continue;

      const novaUrl = await rehostTemporaryImage(produto.imagemUrl, produto.sku);
      if (novaUrl) {
        await prisma.produto.update({ where: { id: produto.id }, data: { imagemUrl: novaUrl } });
        regravados++;
      } else {
        erros++;
      }
    }

    const concluido = produtos.length < TAMANHO_PAGINA;
    const proximoCursor = concluido ? null : produtos[produtos.length - 1]?.id ?? null;

    return NextResponse.json({ examinados, regravados, erros, proximoCursor, concluido });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao regravar imagens do Bling no Vercel Blob:", error);
    return NextResponse.json({ error: "Erro ao regravar imagens" }, { status: 500 });
  }
}
