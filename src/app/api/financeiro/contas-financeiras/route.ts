import { NextRequest, NextResponse } from "next/server";
import { TipoContaFinanceira } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { criarContaFinanceira, listarContasFinanceiras } from "@/modules/financeiro/lancamentos/contasFinanceiras";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const incluirInativas = searchParams.get("incluirInativas") === "true";

    const contas = await listarContasFinanceiras(user.contaId, incluirInativas);
    return NextResponse.json({ contas });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar contas financeiras:", error);
    return NextResponse.json({ error: "Erro ao listar contas financeiras" }, { status: 500 });
  }
}

interface RequestBody {
  nome?: string;
  tipo?: TipoContaFinanceira;
  saldoInicial?: number;
  dataSaldoInicial?: string;
  diaFechamento?: number | null;
  diaVencimento?: number | null;
  limite?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    if (!body.nome || !body.tipo || body.saldoInicial == null || !body.dataSaldoInicial) {
      return NextResponse.json(
        { error: "nome, tipo, saldoInicial e dataSaldoInicial são obrigatórios" },
        { status: 400 }
      );
    }

    const conta = await criarContaFinanceira(user.contaId, {
      nome: body.nome,
      tipo: body.tipo,
      saldoInicial: body.saldoInicial,
      dataSaldoInicial: new Date(body.dataSaldoInicial),
      diaFechamento: body.diaFechamento,
      diaVencimento: body.diaVencimento,
      limite: body.limite,
    });
    return NextResponse.json(conta, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao criar conta financeira:", error);
    return NextResponse.json({ error: "Erro ao criar conta financeira" }, { status: 500 });
  }
}
