import { CanalVenda } from "@prisma/client";
import { comCacheFinanceiro } from "./cache";
import { agruparVendas, buscarVendasParaCalculo, obterConfigRelatorio } from "./motor";

export interface ResumoLogistica {
  logistica: string;
  rotulo: string;
  pedidos: number;
  pedidosCancelados: number;
  unidades: number;
  faturamento: number;
  frete: number;
  freteMedio: number | null;
  tarifas: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
}

const ROTULO_LOGISTICA: Record<string, string> = {
  fulfillment: "Full",
  self_service: "Flex",
  cross_docking: "Coleta",
  xd_drop_off: "Agência (drop-off)",
  drop_off: "Correios / agência",
  default: "Mercado Envios 1",
  custom: "Envio próprio",
  not_specified: "A combinar",
  DESCONHECIDA: "Aguardando detalhes",
};

export function rotuloLogistica(logistica: string | null): string {
  if (!logistica) return ROTULO_LOGISTICA.DESCONHECIDA;
  return ROTULO_LOGISTICA[logistica] ?? logistica;
}

export async function calcularResumoPorLogistica(
  userId: string,
  desde: Date,
  ate: Date,
  canal?: CanalVenda
): Promise<ResumoLogistica[]> {
  const config = await obterConfigRelatorio(userId);
  const chave = `por-logistica:${desde.toISOString()}:${ate.toISOString()}:${canal ?? "todos"}:${config.modoFaturamento}:${config.aliquotaImposto}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const vendas = await buscarVendasParaCalculo(userId, desde, ate, { canal });
    const baldes = agruparVendas(vendas, config, (v) => v.logistica ?? "DESCONHECIDA");

    return [...baldes.entries()]
      .map(([logistica, t]) => ({
        logistica,
        rotulo: rotuloLogistica(logistica === "DESCONHECIDA" ? null : logistica),
        pedidos: t.pedidos,
        pedidosCancelados: t.pedidosCancelados,
        unidades: t.unidades,
        faturamento: t.receitaTotal,
        frete: t.frete,
        freteMedio: t.pedidos === 0 ? null : Math.round(t.frete / t.pedidos),
        tarifas: t.tarifas,
        margemContribuicao: t.margemContribuicaoVendas,
        margemContribuicaoPercentual: t.receitaTotal === 0 ? null : t.margemContribuicaoVendas / t.receitaTotal,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  });
}
