import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { criarRecorrencia, type DadosRecorrencia } from "@/modules/financeiro/lancamentos/recorrencias";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const recorrencias = await prisma.recorrenciaFinanceira.findMany({
      where: { userId: user.contaId },
      include: { categoria: true, contaFinanceira: true, fornecedor: true },
      orderBy: { descricao: "asc" },
    });

    return NextResponse.json({ recorrencias });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar recorrências:", error);
    return NextResponse.json({ error: "Erro ao listar recorrências" }, { status: 500 });
  }
}

interface RequestBody extends Omit<DadosRecorrencia, "inicio" | "fim"> {
  inicio: string;
  fim?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    if (!body.descricao || !body.valor || !body.categoriaId || !body.frequencia || !body.diaVencimento || !body.inicio) {
      return NextResponse.json(
        { error: "descricao, valor, categoriaId, frequencia, diaVencimento e inicio são obrigatórios" },
        { status: 400 }
      );
    }

    const recorrencia = await criarRecorrencia(user.contaId, {
      ...body,
      inicio: new Date(body.inicio),
      fim: body.fim ? new Date(body.fim) : null,
    });

    return NextResponse.json(recorrencia, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao criar recorrência:", error);
    return NextResponse.json({ error: "Erro ao criar recorrência" }, { status: 500 });
  }
}
