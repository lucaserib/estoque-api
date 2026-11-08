import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { calcularFaturamentoComFrete } from "@/modules/financeiro/relatorios/faturamentoComFrete";
import { fimDoDia, inicioDoDia, resolverPeriodoRapido } from "@/modules/financeiro/dominio/periodo";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const desdeTexto = searchParams.get("desde");
    const ateTexto = searchParams.get("ate");
    const canalTexto = searchParams.get("canal");
    const canal =
      canalTexto && (Object.values(CanalVenda) as string[]).includes(canalTexto) ? (canalTexto as CanalVenda) : undefined;

    const intervalo =
      desdeTexto && ateTexto
        ? { desde: inicioDoDia(new Date(desdeTexto)), ate: fimDoDia(new Date(ateTexto)) }
        : (() => {
            const periodo = resolverPeriodoRapido(searchParams.get("periodo"));
            return { desde: periodo.desde, ate: periodo.ate };
          })();

    if (Number.isNaN(intervalo.desde.getTime()) || Number.isNaN(intervalo.ate.getTime())) {
      return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
    }

    const resultado = await calcularFaturamentoComFrete(user.contaId, intervalo.desde, intervalo.ate, canal);
    return NextResponse.json(resultado, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    console.error("Erro ao calcular faturamento com frete:", error);
    return NextResponse.json({ error: "Erro ao calcular faturamento com frete" }, { status: 500 });
  }
}
