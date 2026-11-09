import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { podeVer, permissaoErrorResponse } from "@/lib/permissoes";
import { calcularReposicaoConta } from "@/services/reposicaoService";
import { registrarEvento } from "@/modules/clientes/eventos";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const verCusto = podeVer(user.role, "VER_CUSTO");

    const { sugestoes, parcial } = await calcularReposicaoConta(user.contaId);
    await registrarEvento(user.contaId, "PRIMEIRA_REPOSICAO_VISTA", { userId: user.id });

    const results = sugestoes
      .filter((s) => s.status === "critico" || s.status === "atencao")
      .map((s) => {
        const custoTotalCompraReais =
          verCusto && s.custoTotalCompra ? s.custoTotalCompra / 100 : 0;

        const reposicaoFull = s.temAnuncioFull
          ? {
              necessaria: s.quantidadeSugeridaEnvioFull > 0,
              quantidadeSugerida: s.quantidadeSugeridaEnvioFull,
              diasRestantes:
                s.demandaDiaria > 0
                  ? Math.floor(
                      (s.estoqueFullDisponivel + s.estoqueFullEmTransito) /
                        s.demandaDiaria
                    )
                  : 999,
              status: s.status,
              custoTotal: 0,
            }
          : null;

        const reposicaoLocal = {
          necessaria: s.quantidadeSugeridaCompraUnidades > 0,
          quantidadeSugerida: s.quantidadeSugeridaCompraUnidades,
          diasRestantes:
            s.demandaDiaria > 0
              ? Math.floor(s.estoqueLocal / s.demandaDiaria)
              : 999,
          status: s.status,
          custoTotal: custoTotalCompraReais,
        };

        let tipoAnuncio: "full" | "local" | "ambos" = "local";
        if (s.temAnuncioFull && s.estoqueLocal > 0) {
          tipoAnuncio = "ambos";
        } else if (s.temAnuncioFull) {
          tipoAnuncio = "full";
        }

        return {
          produtoId: s.produtoId,
          produtoNome: s.nome,
          sku: s.sku,
          custoMedio: verCusto ? s.custoMedio || 0 : 0,
          tipoAnuncio,
          estoqueLocal: s.estoqueLocal,
          estoqueFull: s.estoqueFullDisponivel + s.estoqueFullEmTransito,
          estoqueFullDisponivel: s.estoqueFullDisponivel,
          estoqueFullEmTransito: s.estoqueFullEmTransito,
          estoqueFullIndisponivel: s.estoqueFullIndisponivel,
          estoqueTotal:
            s.estoqueLocal + s.estoqueFullDisponivel + s.estoqueFullEmTransito,
          mediaVendasPeriodo: Math.round(s.demandaDiaria * 90),
          mediaDiaria: parseFloat(s.demandaDiaria.toFixed(2)),
          analysisPeriodDays: 90,
          statusGeral: s.status,
          coberturaDiasLocal: s.coberturaDiasLocal,
          coberturaDiasFull: s.coberturaDiasFull,
          dataRupturaPrevista: s.dataRupturaPrevista,
          reposicaoFull,
          reposicaoLocal,
          custoTotalReposicao: custoTotalCompraReais,
          custoIndefinido: s.custoIndefinido,
          fornecedorPrincipalId: s.fornecedorPrincipalId,
          fornecedorPrincipalNome: s.fornecedorPrincipalNome,
        };
      });

    results.sort((a, b) => {
      const prioridadeOrdem = { critico: 1, atencao: 2, ok: 3 };
      if (a.statusGeral !== b.statusGeral) {
        return prioridadeOrdem[a.statusGeral] - prioridadeOrdem[b.statusGeral];
      }
      return a.reposicaoLocal.diasRestantes - b.reposicaoLocal.diasRestantes;
    });

    const summary = results.reduce(
      (acc, r) => {
        acc.total++;
        if (r.statusGeral === "critico") {
          acc.critico++;
          acc.custoTotalCritico += r.custoTotalReposicao;
        } else if (r.statusGeral === "atencao") {
          acc.atencao++;
          acc.custoTotalAtencao += r.custoTotalReposicao;
        }
        acc.custoTotalGeral += r.custoTotalReposicao;
        return acc;
      },
      {
        total: 0,
        critico: 0,
        atencao: 0,
        ok: 0,
        custoTotalCritico: 0,
        custoTotalAtencao: 0,
        custoTotalGeral: 0,
      }
    );

    return NextResponse.json({
      success: true,
      results,
      summary,
      parcial,
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("[BATCH_ANALYSIS] Erro na análise em lote:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao analisar produtos",
      },
      { status: 500 }
    );
  }
}
