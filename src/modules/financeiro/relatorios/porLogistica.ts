import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { comCacheFinanceiro } from "./cache";

export interface ResumoLogistica {
  logistica: string;
  pedidos: number;
  faturamentoBruto: number;
  freteMedio: number | null;
  margemContribuicao: number;
}

const STATUS_CONTAM = [StatusVendaCanal.PAGA, StatusVendaCanal.DEVOLVIDA_PARCIAL];

/**
 * Agrupa vendas por logística (Full `fulfillment`, Flex `self_service`,
 * coleta `drop_off`, e qualquer outro valor que o canal mandar) — não
 * normaliza os nomes, mostra exatamente o que `VendaCanal.logistica` tem
 * gravado, para não esconder um valor desconhecido atrás de "outro".
 */
export async function calcularResumoPorLogistica(
  userId: string,
  desde: Date,
  ate: Date,
  canal?: CanalVenda
): Promise<ResumoLogistica[]> {
  const chave = `por-logistica:${desde.toISOString()}:${ate.toISOString()}:${canal ?? "todos"}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const vendas = await prisma.vendaCanal.findMany({
      where: {
        userId,
        dataVenda: { gte: desde, lte: ate },
        status: { in: STATUS_CONTAM },
        ...(canal && { canal }),
      },
      select: {
        logistica: true,
        faturamentoBruto: true,
        freteVendedor: true,
        margemContribuicao: true,
      },
    });

    const porLogistica = new Map<string, { pedidos: number; faturamentoBruto: number; freteSoma: number; freteContagem: number; margemContribuicao: number }>();

    for (const venda of vendas) {
      const chaveLogistica = venda.logistica ?? "DESCONHECIDA";
      const atual = porLogistica.get(chaveLogistica) ?? {
        pedidos: 0,
        faturamentoBruto: 0,
        freteSoma: 0,
        freteContagem: 0,
        margemContribuicao: 0,
      };
      atual.pedidos += 1;
      atual.faturamentoBruto += venda.faturamentoBruto;
      if (venda.freteVendedor != null) {
        atual.freteSoma += venda.freteVendedor;
        atual.freteContagem += 1;
      }
      atual.margemContribuicao += venda.margemContribuicao ?? 0;
      porLogistica.set(chaveLogistica, atual);
    }

    return [...porLogistica.entries()]
      .map(([logistica, dados]) => ({
        logistica,
        pedidos: dados.pedidos,
        faturamentoBruto: dados.faturamentoBruto,
        freteMedio: dados.freteContagem === 0 ? null : Math.round(dados.freteSoma / dados.freteContagem),
        margemContribuicao: dados.margemContribuicao,
      }))
      .sort((a, b) => b.faturamentoBruto - a.faturamentoBruto);
  });
}
