import type { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fimDoDia, inicioDoDia } from "@/modules/financeiro/dominio/periodo";
import { SITUACOES_NOTA_VALIDA } from "@/modules/financeiro/canais/erp/bling/notasFiscais";
import { buscarVendasParaCalculo, calcularVenda, obterConfigRelatorio } from "./motor";
import { comCacheFinanceiro } from "./cache";

export interface ValoresFaturamento {
  pedidos: number;
  produtos: number;
  freteComprador: number;
  freteVendedor: number;
  comFrete: number;
  notasQuantidade: number;
  notasValor: number;
  notasFrete: number;
  pedidosComNota: number;
}

export interface DiaFaturamento extends ValoresFaturamento {
  dia: string;
}

export interface FaturamentoComFrete {
  totais: ValoresFaturamento;
  dias: DiaFaturamento[];
  coberturaNotas: number | null;
  temNotas: boolean;
}

function vazio(): ValoresFaturamento {
  return {
    pedidos: 0,
    produtos: 0,
    freteComprador: 0,
    freteVendedor: 0,
    comFrete: 0,
    notasQuantidade: 0,
    notasValor: 0,
    notasFrete: 0,
    pedidosComNota: 0,
  };
}

function somar(destino: ValoresFaturamento, origem: Partial<ValoresFaturamento>) {
  for (const chave of Object.keys(origem) as Array<keyof ValoresFaturamento>) {
    destino[chave] += origem[chave] ?? 0;
  }
}

export async function calcularFaturamentoComFrete(
  userId: string,
  desde: Date,
  ate: Date,
  canal?: CanalVenda
): Promise<FaturamentoComFrete> {
  const config = await obterConfigRelatorio(userId);
  const chave = `faturamento-com-frete:${desde.toISOString()}:${ate.toISOString()}:${canal ?? "todos"}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const agora = new Date();
    const fim = ate < agora ? ate : agora;
    const [vendas, notas] = await Promise.all([
      buscarVendasParaCalculo(userId, desde, fim, { canal }),
      prisma.notaFiscalVenda.findMany({
        where: { userId, dataEmissao: { gte: inicioDoDia(desde), lte: fim }, situacao: { in: [...SITUACOES_NOTA_VALIDA] } },
        select: { dataEmissao: true, valorNota: true, valorFrete: true },
      }),
    ]);

    const idsVendas = vendas.map((v) => v.id);
    const vendasComNota =
      idsVendas.length === 0
        ? new Set<string>()
        : new Set(
            (
              await prisma.notaFiscalVenda.findMany({
                where: { userId, vendaCanalId: { in: idsVendas }, situacao: { in: [...SITUACOES_NOTA_VALIDA] } },
                select: { vendaCanalId: true },
              })
            ).map((n) => n.vendaCanalId as string)
          );

    const porDia = new Map<string, ValoresFaturamento>();
    const balde = (data: Date) => {
      const chaveDia = inicioDoDia(data).toISOString();
      const atual = porDia.get(chaveDia) ?? vazio();
      porDia.set(chaveDia, atual);
      return atual;
    };

    const totais = vazio();
    for (const venda of vendas) {
      const calculo = calcularVenda(venda, config);
      if (!calculo.valida) continue;
      const freteVendedor = venda.freteVendedor ?? 0;
      const freteComprador = venda.freteComprador;
      const parcela: Partial<ValoresFaturamento> = {
        pedidos: 1,
        produtos: calculo.faturamento,
        freteComprador,
        freteVendedor,
        comFrete: calculo.faturamento + freteComprador + freteVendedor,
        pedidosComNota: vendasComNota.has(venda.id) ? 1 : 0,
      };
      somar(balde(venda.dataVenda), parcela);
      somar(totais, parcela);
    }

    for (const nota of notas) {
      const parcela: Partial<ValoresFaturamento> = {
        notasQuantidade: 1,
        notasValor: nota.valorNota,
        notasFrete: nota.valorFrete,
      };
      somar(balde(nota.dataEmissao), parcela);
      somar(totais, parcela);
    }

    const dias: DiaFaturamento[] = [];
    let cursor = inicioDoDia(desde);
    while (cursor <= fim) {
      const chaveDia = cursor.toISOString();
      dias.push({ dia: chaveDia, ...(porDia.get(chaveDia) ?? vazio()) });
      cursor = new Date(fimDoDia(cursor).getTime() + 1);
    }

    return {
      totais,
      dias,
      coberturaNotas: totais.pedidos > 0 ? totais.pedidosComNota / totais.pedidos : null,
      temNotas: totais.notasQuantidade > 0,
    };
  });
}
