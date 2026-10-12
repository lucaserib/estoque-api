import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  atualizarContaFinanceira,
  ContaFinanceiraNaoEncontradaError,
} from "@/modules/financeiro/lancamentos/contasFinanceiras";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    const body = await request.json();
    const dados = {
      ...body,
      ...(body.dataSaldoInicial && { dataSaldoInicial: new Date(body.dataSaldoInicial) }),
    };

    const conta = await atualizarContaFinanceira(user.contaId, id, dados);
    return NextResponse.json(conta);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof ContaFinanceiraNaoEncontradaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Erro ao atualizar conta financeira:", error);
    return NextResponse.json({ error: "Erro ao atualizar conta financeira" }, { status: 500 });
  }
}
