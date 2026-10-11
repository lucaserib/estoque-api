import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  atualizarRecorrencia,
  type AtualizacaoRecorrencia,
} from "@/modules/financeiro/lancamentos/recorrencias";

interface RequestBody extends Omit<AtualizacaoRecorrencia, "fim"> {
  fim?: string | null;
  aplicarAosPrevistos?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    const body: RequestBody = await request.json();
    const { aplicarAosPrevistos, fim, ...dados } = body;
    const dadosConvertidos: AtualizacaoRecorrencia = {
      ...dados,
      ...(fim !== undefined && { fim: fim ? new Date(fim) : null }),
    };

    await atualizarRecorrencia(user.contaId, id, dadosConvertidos, aplicarAosPrevistos ?? false);

    return NextResponse.json({ success: true });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao atualizar recorrência:", error);
    return NextResponse.json({ error: "Erro ao atualizar recorrência" }, { status: 500 });
  }
}
