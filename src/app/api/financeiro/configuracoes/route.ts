import { NextRequest, NextResponse } from "next/server";
import {
  CancelamentoCompetencia,
  RateioCustoFixo,
  RegimeTributario,
} from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const config = await prisma.configuracaoGeral.findUnique({ where: { userId: user.contaId } });

    return NextResponse.json({
      regimeTributario: config?.regimeTributario ?? RegimeTributario.SIMPLES,
      aliquotaImposto: config?.aliquotaImposto ?? 0,
      cancelamentoNaCompetencia: config?.cancelamentoNaCompetencia ?? CancelamentoCompetencia.VENDA,
      rateioCustoFixo: config?.rateioCustoFixo ?? RateioCustoFixo.FATURAMENTO,
      custoEnvioFlex: config?.custoEnvioFlex ?? null,
      usarImpostoEstimado: config?.usarImpostoEstimado ?? true,
      usarRelatorioLiberacaoMercadoPago: config?.usarRelatorioLiberacaoMercadoPago ?? false,
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao buscar configurações do financeiro:", error);
    return NextResponse.json({ error: "Erro ao buscar configurações do financeiro" }, { status: 500 });
  }
}

interface RequestBody {
  regimeTributario?: RegimeTributario;
  aliquotaImposto?: number;
  cancelamentoNaCompetencia?: CancelamentoCompetencia;
  rateioCustoFixo?: RateioCustoFixo;
  custoEnvioFlex?: number | null;
  usarImpostoEstimado?: boolean;
  usarRelatorioLiberacaoMercadoPago?: boolean;
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();

    if (body.regimeTributario && !Object.values(RegimeTributario).includes(body.regimeTributario)) {
      return NextResponse.json({ error: "regimeTributario inválido" }, { status: 400 });
    }
    if (
      body.aliquotaImposto !== undefined &&
      (typeof body.aliquotaImposto !== "number" ||
        Number.isNaN(body.aliquotaImposto) ||
        body.aliquotaImposto < 0 ||
        body.aliquotaImposto > 1)
    ) {
      return NextResponse.json({ error: "aliquotaImposto deve ser um número entre 0 e 1" }, { status: 400 });
    }
    if (
      body.cancelamentoNaCompetencia &&
      !Object.values(CancelamentoCompetencia).includes(body.cancelamentoNaCompetencia)
    ) {
      return NextResponse.json({ error: "cancelamentoNaCompetencia inválido" }, { status: 400 });
    }
    if (body.rateioCustoFixo && !Object.values(RateioCustoFixo).includes(body.rateioCustoFixo)) {
      return NextResponse.json({ error: "rateioCustoFixo inválido" }, { status: 400 });
    }
    if (body.custoEnvioFlex != null && (typeof body.custoEnvioFlex !== "number" || body.custoEnvioFlex < 0)) {
      return NextResponse.json({ error: "custoEnvioFlex deve ser um número não negativo" }, { status: 400 });
    }

    const dados = {
      ...(body.regimeTributario && { regimeTributario: body.regimeTributario }),
      ...(body.aliquotaImposto !== undefined && { aliquotaImposto: body.aliquotaImposto }),
      ...(body.cancelamentoNaCompetencia && { cancelamentoNaCompetencia: body.cancelamentoNaCompetencia }),
      ...(body.rateioCustoFixo && { rateioCustoFixo: body.rateioCustoFixo }),
      ...(body.custoEnvioFlex !== undefined && { custoEnvioFlex: body.custoEnvioFlex }),
      ...(body.usarImpostoEstimado !== undefined && { usarImpostoEstimado: body.usarImpostoEstimado }),
      ...(body.usarRelatorioLiberacaoMercadoPago !== undefined && {
        usarRelatorioLiberacaoMercadoPago: body.usarRelatorioLiberacaoMercadoPago,
      }),
    };

    const config = await prisma.configuracaoGeral.upsert({
      where: { userId: user.contaId },
      update: dados,
      create: { userId: user.contaId, ...dados },
    });

    return NextResponse.json(config);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao atualizar configurações do financeiro:", error);
    return NextResponse.json({ error: "Erro ao atualizar configurações do financeiro" }, { status: 500 });
  }
}
