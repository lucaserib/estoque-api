import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { gerarAnaliseIa, normalizarConteudoAnalise } from "@/modules/controle/analiseIa";
import { obterAcessoIa } from "@/modules/ia/acesso";
import { IaIndisponivelError, statusHttpDoErroIa } from "@/modules/ia/erros";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");
    const [acesso, historico] = await Promise.all([
      obterAcessoIa(user.contaId),
      prisma.analiseIa.findMany({
        where: { userId: user.contaId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          tipo: true,
          periodoInicio: true,
          periodoFim: true,
          notaDiagnostico: true,
          conteudo: true,
        },
      }),
    ]);
    return NextResponse.json({
      acesso,
      historico: historico.map((a) => ({ ...a, conteudo: normalizarConteudoAnalise(a.conteudo) })),
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    console.error("[ANALISE_IA] Erro ao obter status:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erro ao carregar a análise com IA" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");
    const limite = await checkRateLimit("analise-ia", user.contaId, 3, 60);
    if (!limite.allowed) return rateLimitResponse(limite);

    const analise = await gerarAnaliseIa(user.contaId, user.id);
    return NextResponse.json({
      id: analise.id,
      createdAt: analise.createdAt,
      tipo: analise.tipo,
      notaDiagnostico: analise.notaDiagnostico,
      conteudo: normalizarConteudoAnalise(analise.conteudo),
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof IaIndisponivelError) {
      return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: statusHttpDoErroIa(error.codigo) });
    }
    console.error("[ANALISE_IA] Erro ao gerar análise:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erro ao gerar a análise" }, { status: 500 });
  }
}
