import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { registrarCompraNoCartao, type DadosCompraCartao } from "@/modules/financeiro/lancamentos/cartao";

interface RequestBody extends Omit<DadosCompraCartao, "dataCompra"> {
  contaFinanceiraId: string;
  dataCompra: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    if (!body.contaFinanceiraId || !body.descricao || !body.valor || !body.categoriaId || !body.dataCompra) {
      return NextResponse.json(
        { error: "contaFinanceiraId, descricao, valor, categoriaId e dataCompra são obrigatórios" },
        { status: 400 }
      );
    }

    const lancamento = await registrarCompraNoCartao(user.contaId, user.id, body.contaFinanceiraId, {
      ...body,
      dataCompra: new Date(body.dataCompra),
    });

    return NextResponse.json(lancamento, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao registrar compra no cartão:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar compra no cartão" },
      { status: 400 }
    );
  }
}
