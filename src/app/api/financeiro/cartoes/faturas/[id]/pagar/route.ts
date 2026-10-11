import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { pagarFatura } from "@/modules/financeiro/lancamentos/cartao";

interface RequestBody {
  contaBancariaId?: string;
  dataPagamento?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    const body: RequestBody = await request.json();
    if (!body.contaBancariaId) {
      return NextResponse.json({ error: "contaBancariaId é obrigatório" }, { status: 400 });
    }

    const resultado = await pagarFatura(
      user.contaId,
      id,
      body.contaBancariaId,
      body.dataPagamento ? new Date(body.dataPagamento) : undefined
    );

    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao pagar fatura:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao pagar fatura" },
      { status: 400 }
    );
  }
}
