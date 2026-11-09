import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const { produtoMercadoLivreId, pausado } = await request.json();

    if (!produtoMercadoLivreId || typeof pausado !== "boolean") {
      return NextResponse.json(
        { error: "produtoMercadoLivreId e pausado (boolean) são obrigatórios" },
        { status: 400 }
      );
    }

    const produtoML = await prisma.produtoMercadoLivre.findFirst({
      where: {
        id: produtoMercadoLivreId,
        mercadoLivreAccount: { userId: user.contaId },
      },
    });

    if (!produtoML) {
      return NextResponse.json(
        { error: "Anúncio não encontrado" },
        { status: 404 }
      );
    }

    await prisma.produtoMercadoLivre.update({
      where: { id: produtoMercadoLivreId },
      data: { mlAutoStockPausado: pausado },
    });

    return NextResponse.json({ success: true, pausado });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao atualizar pausa de envio automático:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
