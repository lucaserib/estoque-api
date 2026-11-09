import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  definirAjusteManualFrete,
  limparAjusteManualFrete,
} from "@/modules/financeiro/ingestao/sincronizador";

interface RequestBody {
  valorReais?: number | null;
  motivo?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserAtivo(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    const venda = await prisma.vendaCanal.findFirst({
      where: { id, userId: user.contaId },
      select: { id: true },
    });
    if (!venda) {
      return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
    }

    const body: RequestBody = await request.json().catch(() => ({}));

    if (body.valorReais == null) {
      await limparAjusteManualFrete(venda.id);
      return NextResponse.json({ status: "RECALCULADO" });
    }

    if (typeof body.valorReais !== "number" || Number.isNaN(body.valorReais) || body.valorReais < 0) {
      return NextResponse.json({ error: "valorReais deve ser um número não negativo" }, { status: 400 });
    }
    if (!body.motivo || !body.motivo.trim()) {
      return NextResponse.json(
        { error: "Informe o motivo do ajuste manual do frete" },
        { status: 400 }
      );
    }

    const valorCentavos = Math.round(body.valorReais * 100);
    await definirAjusteManualFrete(venda.id, valorCentavos, body.motivo.trim(), user.id);

    return NextResponse.json({ status: "AJUSTADO" });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao ajustar frete manualmente:", error);
    return NextResponse.json({ error: "Erro ao ajustar frete" }, { status: 500 });
  }
}
