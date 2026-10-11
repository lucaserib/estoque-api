import crypto from "crypto";
import { Confianca, OrigemLancamento, StatusLancamento, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dividirEmParcelas } from "../dominio/dinheiro";
import { somarMeses } from "../dominio/periodo";

export interface DadosCompraParcelada {
  descricao: string;
  valorTotal: number;
  categoriaId: string;
  contaFinanceiraId?: string | null;
  fornecedorId?: string | null;
  /** A compra em si é reconhecida uma vez só, no mês da compra — só o caixa se espalha pelas parcelas. */
  competencia: Date;
  primeiroVencimento: Date;
  numeroDeParcelas: number;
}

export async function criarCompraParcelada(
  userId: string,
  criadoPorId: string,
  dados: DadosCompraParcelada
) {
  const grupoParcelamentoId = crypto.randomUUID();
  const valores = dividirEmParcelas(dados.valorTotal, dados.numeroDeParcelas);

  const lancamentos = [];
  for (let i = 0; i < dados.numeroDeParcelas; i++) {
    const vencimento = somarMeses(dados.primeiroVencimento, i);
    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        userId,
        criadoPorId,
        tipo: TipoLancamento.DESPESA,
        descricao: `${dados.descricao} (${i + 1}/${dados.numeroDeParcelas})`,
        valor: valores[i],
        categoriaId: dados.categoriaId,
        contaFinanceiraId: dados.contaFinanceiraId ?? null,
        fornecedorId: dados.fornecedorId ?? null,
        competencia: dados.competencia,
        vencimento,
        status: StatusLancamento.PREVISTO,
        origem: OrigemLancamento.PARCELAMENTO,
        confianca: Confianca.CONFIRMADO,
        grupoParcelamentoId,
        parcelaNumero: i + 1,
        parcelaTotal: dados.numeroDeParcelas,
      },
    });
    lancamentos.push(lancamento);
  }

  return { grupoParcelamentoId, lancamentos };
}
