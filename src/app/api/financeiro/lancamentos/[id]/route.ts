import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  atualizarLancamento,
  excluirLancamento,
  LancamentoNaoEncontradoError,
} from "@/modules/financeiro/lancamentos/servico";

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
      ...(body.competencia && { competencia: new Date(body.competencia) }),
      ...(body.vencimento && { vencimento: new Date(body.vencimento) }),
      ...(body.pagamento && { pagamento: new Date(body.pagamento) }),
    };

    const lancamento = await atualizarLancamento(user.contaId, id, dados);
    return NextResponse.json(lancamento);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof LancamentoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Erro ao atualizar lançamento:", error);
    return NextResponse.json({ error: "Erro ao atualizar lançamento" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    await excluirLancamento(user.contaId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof LancamentoNaoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Erro ao excluir lançamento:", error);
    return NextResponse.json({ error: "Erro ao excluir lançamento" }, { status: 500 });
  }
}
