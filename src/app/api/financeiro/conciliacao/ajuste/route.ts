import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  gerarLancamentoAjusteConciliacao,
  gerarRelatorioConciliacao,
  type LinhaConciliacao,
} from "@/modules/financeiro/relatorios/conciliacao";

interface RequestBody {
  canal?: CanalVenda;
  mes?: string;
  tipo?: LinhaConciliacao["tipo"];
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    const canal = body.canal ?? CanalVenda.MERCADO_LIVRE;

    if (!body.mes || !/^\d{4}-\d{2}$/.test(body.mes) || !body.tipo) {
      return NextResponse.json(
        { error: "mes (AAAA-MM) e tipo são obrigatórios" },
        { status: 400 }
      );
    }

    const relatorio = await gerarRelatorioConciliacao(user.contaId, canal, body.mes);
    const linha = relatorio.linhas.find((l) => l.tipo === body.tipo);

    if (!linha) {
      return NextResponse.json(
        { error: `Tipo ${body.tipo} não encontrado no relatório do mês` },
        { status: 404 }
      );
    }

    const lancamento = await gerarLancamentoAjusteConciliacao(
      user.contaId,
      user.id,
      canal,
      body.mes,
      linha
    );

    return NextResponse.json(lancamento, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar lançamento de ajuste de conciliação:", error);
    return NextResponse.json(
      { error: "Erro ao gerar lançamento de ajuste" },
      { status: 500 }
    );
  }
}
