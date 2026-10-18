import { NextRequest, NextResponse } from "next/server";
import { TipoValorFreteLogistica } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const regras = await prisma.regraFreteLogistica.findMany({
      where: { userId: user.contaId },
      orderBy: { logistica: "asc" },
    });

    return NextResponse.json(regras);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao buscar regras de frete por logística:", error);
    return NextResponse.json({ error: "Erro ao buscar regras de frete" }, { status: 500 });
  }
}

interface RequestBody {
  logistica?: string;
  tipoValor?: TipoValorFreteLogistica;
  valorReais?: number;
  percentual?: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();

    if (!body.logistica || !body.logistica.trim()) {
      return NextResponse.json({ error: "logistica é obrigatória" }, { status: 400 });
    }
    if (!body.tipoValor || !Object.values(TipoValorFreteLogistica).includes(body.tipoValor)) {
      return NextResponse.json({ error: "tipoValor deve ser FIXO ou PERCENTUAL" }, { status: 400 });
    }
    if (body.tipoValor === TipoValorFreteLogistica.FIXO) {
      if (typeof body.valorReais !== "number" || Number.isNaN(body.valorReais) || body.valorReais < 0) {
        return NextResponse.json({ error: "valorReais deve ser um número não negativo" }, { status: 400 });
      }
    } else {
      if (
        typeof body.percentual !== "number" ||
        Number.isNaN(body.percentual) ||
        body.percentual < 0 ||
        body.percentual > 1
      ) {
        return NextResponse.json({ error: "percentual deve ser um número entre 0 e 1" }, { status: 400 });
      }
    }

    const logistica = body.logistica.trim();
    const regra = await prisma.regraFreteLogistica.upsert({
      where: { userId_logistica: { userId: user.contaId, logistica } },
      create: {
        userId: user.contaId,
        logistica,
        tipoValor: body.tipoValor,
        valor: body.tipoValor === TipoValorFreteLogistica.FIXO ? Math.round(body.valorReais! * 100) : 0,
        percentual: body.tipoValor === TipoValorFreteLogistica.PERCENTUAL ? body.percentual! : 0,
      },
      update: {
        tipoValor: body.tipoValor,
        valor: body.tipoValor === TipoValorFreteLogistica.FIXO ? Math.round(body.valorReais! * 100) : 0,
        percentual: body.tipoValor === TipoValorFreteLogistica.PERCENTUAL ? body.percentual! : 0,
      },
    });

    return NextResponse.json(regra);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao salvar regra de frete por logística:", error);
    return NextResponse.json({ error: "Erro ao salvar regra de frete" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const logistica = request.nextUrl.searchParams.get("logistica");
    if (!logistica) {
      return NextResponse.json({ error: "logistica é obrigatória" }, { status: 400 });
    }

    await prisma.regraFreteLogistica.deleteMany({ where: { userId: user.contaId, logistica } });

    return NextResponse.json({ status: "REMOVIDA" });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao remover regra de frete por logística:", error);
    return NextResponse.json({ error: "Erro ao remover regra de frete" }, { status: 500 });
  }
}
