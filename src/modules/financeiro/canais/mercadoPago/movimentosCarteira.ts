import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { conferirLiberacoes } from "./liberacoes";

export type TipoMovimentoCarteira = "LIBERACAO" | "RETENCAO" | "RELATORIO_MP";

export interface MovimentoCarteira {
  tipo: TipoMovimentoCarteira;
  data: Date;
  valor: number;
  referencia: string | null;
}

export interface MovimentosCarteira {
  movimentos: MovimentoCarteira[];
  totalLiberacoes: number;
  totalRetencoes: number;
  liquidoPeriodoVendas: number;
  relatorioMpHabilitado: boolean;
  totalRelatorioMp: number;
}

/**
 * `RELATORIO_MP` vem de `conferirLiberacoes` (relatório bruto de liberação
 * do Mercado Pago, Ciclo 7/8) e pode incluir as mesmas liberações já
 * listadas como `LIBERACAO` a partir de `VendaCanal` — os dois não têm uma
 * chave em comum confirmada para deduplicar, então `totalRelatorioMp` fica
 * separado de `liquidoPeriodoVendas` (nunca somados), evitando contar a
 * mesma liberação duas vezes.
 */
export async function listarMovimentosCarteira(
  userId: string,
  accountId: string,
  desde: Date,
  ate: Date
): Promise<MovimentosCarteira> {
  const agora = new Date();
  const fimEfetivo = ate < agora ? ate : agora;

  const vendas = await prisma.vendaCanal.findMany({
    where: {
      userId,
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId: accountId,
      dataLiberacao: { gte: desde, lte: fimEfetivo },
      statusLiberacao: "released",
    },
    select: { pedidoExternoId: true, dataLiberacao: true, valorLiquidoReceber: true, retencaoDividas: true },
  });

  const movimentos: MovimentoCarteira[] = [];
  for (const venda of vendas) {
    if (venda.valorLiquidoReceber != null) {
      movimentos.push({
        tipo: "LIBERACAO",
        data: venda.dataLiberacao as Date,
        valor: venda.valorLiquidoReceber,
        referencia: venda.pedidoExternoId,
      });
    }
    if (venda.retencaoDividas > 0) {
      movimentos.push({
        tipo: "RETENCAO",
        data: venda.dataLiberacao as Date,
        valor: -venda.retencaoDividas,
        referencia: venda.pedidoExternoId,
      });
    }
  }

  const relatorio = await conferirLiberacoes(userId, accountId, desde, fimEfetivo);
  for (const liberacao of relatorio.liberacoes) {
    movimentos.push({
      tipo: "RELATORIO_MP",
      data: liberacao.data,
      valor: liberacao.valor,
      referencia: liberacao.referenciaExterna,
    });
  }

  movimentos.sort((a, b) => a.data.getTime() - b.data.getTime());

  const totalLiberacoes = movimentos
    .filter((m) => m.tipo === "LIBERACAO")
    .reduce((soma, m) => soma + m.valor, 0);
  const totalRetencoes = movimentos
    .filter((m) => m.tipo === "RETENCAO")
    .reduce((soma, m) => soma + m.valor, 0);
  const totalRelatorioMp = movimentos
    .filter((m) => m.tipo === "RELATORIO_MP")
    .reduce((soma, m) => soma + m.valor, 0);

  return {
    movimentos,
    totalLiberacoes,
    totalRetencoes,
    liquidoPeriodoVendas: totalLiberacoes + totalRetencoes,
    relatorioMpHabilitado: relatorio.habilitado,
    totalRelatorioMp,
  };
}
