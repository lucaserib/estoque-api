import { NextRequest, NextResponse } from "next/server";
import {
  OrigemLancamento,
  StatusLancamento,
  TipoLancamento,
} from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { criarLancamento, listarLancamentos, type DadosLancamento } from "@/modules/financeiro/lancamentos/servico";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get("desde");
    const ate = searchParams.get("ate");

    const lancamentos = await listarLancamentos(user.contaId, {
      desde: desde ? new Date(desde) : undefined,
      ate: ate ? new Date(ate) : undefined,
      status: (searchParams.get("status") as StatusLancamento) ?? undefined,
      categoriaId: searchParams.get("categoriaId") ?? undefined,
      contaFinanceiraId: searchParams.get("contaFinanceiraId") ?? undefined,
      fornecedorId: searchParams.get("fornecedorId") ?? undefined,
      origem: (searchParams.get("origem") as OrigemLancamento) ?? undefined,
      tipo: (searchParams.get("tipo") as TipoLancamento) ?? undefined,
    });

    return NextResponse.json({ lancamentos });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar lançamentos:", error);
    return NextResponse.json({ error: "Erro ao listar lançamentos" }, { status: 500 });
  }
}

interface RequestBody extends Omit<DadosLancamento, "competencia" | "vencimento" | "pagamento"> {
  competencia: string;
  vencimento: string;
  pagamento?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    if (!body.descricao || !body.valor || !body.categoriaId || !body.competencia || !body.vencimento) {
      return NextResponse.json(
        { error: "descricao, valor, categoriaId, competencia e vencimento são obrigatórios" },
        { status: 400 }
      );
    }

    const lancamento = await criarLancamento(user.contaId, user.id, {
      ...body,
      competencia: new Date(body.competencia),
      vencimento: new Date(body.vencimento),
      pagamento: body.pagamento ? new Date(body.pagamento) : null,
    });

    return NextResponse.json(lancamento, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao criar lançamento:", error);
    return NextResponse.json({ error: "Erro ao criar lançamento" }, { status: 500 });
  }
}
