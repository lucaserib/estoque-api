import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarContaAPagarDePedidoCompra } from "@/modules/financeiro/lancamentos/pedidoCompra";

interface RequestBody {
  vencimento?: string;
  numeroDeParcelas?: number;
  contaFinanceiraId?: string | null;
}

/**
 * Botão "Gerar conta a pagar" oferecido depois de confirmar um pedido de
 * compra (Fase 5 item 6) — não toca na rota de confirmação em si
 * (src/app/api/pedidos-compra/route.ts), é um passo seguinte, opcional,
 * disparado pela tela.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    const body: RequestBody = await request.json();
    if (!body.vencimento) {
      return NextResponse.json({ error: "vencimento é obrigatório" }, { status: 400 });
    }

    const resultado = await gerarContaAPagarDePedidoCompra(user.contaId, user.id, Number(id), {
      vencimento: new Date(body.vencimento),
      numeroDeParcelas: body.numeroDeParcelas,
      contaFinanceiraId: body.contaFinanceiraId,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar conta a pagar do pedido de compra:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar conta a pagar" },
      { status: 400 }
    );
  }
}
