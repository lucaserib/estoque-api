import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { blingErrorResponse } from "@/lib/blingApi";
import { mlCache, createCacheKey } from "@/lib/cache";
import { BlingRateLimitError, BlingReconnectError } from "@/services/blingService";
import { sincronizarEstoqueUnico, sincronizarProdutoUnico } from "@/services/blingProductSync";

const corpoSchema = z.object({ blingIds: z.array(z.number().int().positive()).min(1).max(20) });

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const parsed = corpoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Escolha de 1 a 20 produtos." }, { status: 400 });
    }

    const conta = await prisma.blingAccount.findFirst({
      where: { userId: user.contaId, isActive: true },
      select: { id: true },
    });
    if (!conta) {
      return NextResponse.json({ error: "Conecte o Bling em Integrações." }, { status: 404 });
    }

    const resultados: Array<{ blingId: number; produtoId?: string; criado?: boolean; erro?: string }> = [];
    for (const blingId of parsed.data.blingIds) {
      try {
        const { produtoId, criado } = await sincronizarProdutoUnico(conta.id, user.contaId, blingId);
        await sincronizarEstoqueUnico(conta.id, user.contaId, blingId);
        resultados.push({ blingId, produtoId, criado });
      } catch (erro) {
        if (erro instanceof BlingReconnectError || erro instanceof BlingRateLimitError) throw erro;
        resultados.push({ blingId, erro: erro instanceof Error ? erro.message : "Erro ao importar" });
      }
    }

    await mlCache.delete(createCacheKey("pendencias", user.contaId));
    return NextResponse.json({ resultados });
  } catch (error) {
    const permissao = permissaoErrorResponse(error);
    if (permissao) return permissao;
    return blingErrorResponse(error);
  }
}
