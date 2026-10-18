import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const vinculos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccount: { userId: user.contaId },
        produtoId: { not: null },
        vinculoConfirmado: false,
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        vinculoOrigem: true,
        produto: { select: { id: true, nome: true, sku: true } },
      },
      orderBy: { lastSyncAt: "desc" },
    });

    return NextResponse.json({
      vinculos: vinculos.map((v) => ({
        id: v.id,
        mlItemId: v.mlItemId,
        mlTitle: v.mlTitle,
        origem: v.vinculoOrigem,
        produto: v.produto,
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
  acao?: "confirmar" | "rejeitar";
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
    } else {
      await prisma.produtoMercadoLivre.update({
        where: { id: vinculo.id },
        data: { produtoId: null, vinculoOrigem: null, vinculoConfirmado: true, syncStatus: "pending" },
      });
    }

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao confirmar/rejeitar vínculo:", error);
    return NextResponse.json({ error: "Erro ao confirmar vínculo" }, { status: 500 });
  }
}
