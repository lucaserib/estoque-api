import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { normalizeSku } from "@/lib/sku";

type MotivoPendencia = "NAO_CONFIRMADO" | "SKU_DIVERGENTE";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const vinculos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccount: { userId: user.contaId },
        produtoId: { not: null },
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlSellerSku: true,
        vinculoOrigem: true,
        vinculoConfirmado: true,
        produto: { select: { id: true, nome: true, sku: true } },
      },
      orderBy: { lastSyncAt: "desc" },
    });

    const pendentes = vinculos
      .map((v) => {
        const motivos: MotivoPendencia[] = [];
        if (!v.vinculoConfirmado) motivos.push("NAO_CONFIRMADO");
        if (v.mlSellerSku && v.produto && normalizeSku(v.mlSellerSku) !== normalizeSku(v.produto.sku)) {
          motivos.push("SKU_DIVERGENTE");
        }
        return { v, motivos };
      })
      .filter(({ motivos }) => motivos.length > 0);

    return NextResponse.json({
      vinculos: pendentes.map(({ v, motivos }) => ({
        id: v.id,
        mlItemId: v.mlItemId,
        mlTitle: v.mlTitle,
        mlSellerSku: v.mlSellerSku,
        origem: v.vinculoOrigem,
        produto: v.produto,
        motivos,
      })),
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar vínculos pendentes de confirmação:", error);
    return NextResponse.json({ error: "Erro ao listar vínculos pendentes" }, { status: 500 });
  }
}

interface RequestBody {
  id?: string;
  acao?: "confirmar" | "rejeitar" | "trocar";
  novoProdutoId?: string;
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const body: RequestBody = await request.json();
    if (!body.id || !body.acao) {
      return NextResponse.json({ error: "id e acao são obrigatórios" }, { status: 400 });
    }

    const vinculo = await prisma.produtoMercadoLivre.findFirst({
      where: { id: body.id, mercadoLivreAccount: { userId: user.contaId } },
    });
    if (!vinculo) {
      return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
    }

    if (body.acao === "confirmar") {
      await prisma.produtoMercadoLivre.update({
        where: { id: vinculo.id },
        data: { vinculoConfirmado: true, syncStatus: "matched" },
      });
    } else if (body.acao === "rejeitar") {
      await prisma.produtoMercadoLivre.update({
        where: { id: vinculo.id },
        data: { produtoId: null, vinculoOrigem: null, vinculoConfirmado: true, syncStatus: "pending" },
      });
    } else {
      if (!body.novoProdutoId) {
        return NextResponse.json({ error: "novoProdutoId é obrigatório para trocar o vínculo" }, { status: 400 });
      }
      const novoProduto = await prisma.produto.findFirst({
        where: { id: body.novoProdutoId, userId: user.contaId },
        select: { id: true },
      });
      if (!novoProduto) {
        return NextResponse.json({ error: "Produto novo não encontrado" }, { status: 404 });
      }
      await prisma.produtoMercadoLivre.update({
        where: { id: vinculo.id },
        data: { produtoId: novoProduto.id, vinculoOrigem: "MANUAL", vinculoConfirmado: true, syncStatus: "matched" },
      });
    }

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao confirmar/rejeitar/trocar vínculo:", error);
    return NextResponse.json({ error: "Erro ao atualizar vínculo" }, { status: 500 });
  }
}
