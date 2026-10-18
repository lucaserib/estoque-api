import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { invalidarCacheFinanceiro } from "@/modules/financeiro/relatorios/cache";
import { ajustarSaldoConta, ContaParaAjusteNaoEncontradaError } from "@/modules/financeiro/relatorios/saldoContas";

interface RequestBody {
  saldoAtual?: number;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    const body: RequestBody = await request.json().catch(() => ({}));
    if (typeof body.saldoAtual !== "number" || !Number.isInteger(body.saldoAtual)) {
      return NextResponse.json({ error: "Informe 'saldoAtual' em centavos" }, { status: 400 });
    }

    await ajustarSaldoConta(user.contaId, id, body.saldoAtual);
    await invalidarCacheFinanceiro(user.contaId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof ContaParaAjusteNaoEncontradaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Erro ao ajustar saldo da conta:", error);
    return NextResponse.json({ error: "Erro ao ajustar saldo da conta" }, { status: 500 });
  }
}
