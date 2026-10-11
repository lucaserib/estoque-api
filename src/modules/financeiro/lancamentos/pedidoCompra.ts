import crypto from "crypto";
import { Confianca, OrigemLancamento, StatusLancamento, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seedPlanoContasPadrao } from "./planoContasPadrao";
import { dividirEmParcelas } from "../dominio/dinheiro";
import { somarMeses } from "../dominio/periodo";

async function resolverCategoriaCompraDeMercadoria(userId: string): Promise<string> {
  await seedPlanoContasPadrao(userId);
  const categoria = await prisma.categoriaFinanceira.findFirst({
    where: { userId, nome: "Compra de mercadoria (estoque)", paiId: null },
    select: { id: true },
  });
  if (!categoria) {
    throw new Error('Categoria "Compra de mercadoria (estoque)" não encontrada mesmo após o seed');
  }
  return categoria.id;
}

export interface DadosContaAPagarDePedido {
  vencimento: Date;
  numeroDeParcelas?: number;
  contaFinanceiraId?: string | null;
}

/**
 * Entra no fluxo de caixa como "Compra de mercadoria (estoque)", fora da
 * DRE — a DRE já recebe o CMV no momento da venda (VendaCanal.cmv), não da
 * compra. Idempotente por chaveExterna: gerar de novo para o mesmo pedido
 * não duplica.
 */
export async function gerarContaAPagarDePedidoCompra(
  userId: string,
  criadoPorId: string,
  pedidoCompraId: number,
  dados: DadosContaAPagarDePedido
) {
  const pedido = await prisma.pedidoCompra.findFirst({
    where: { id: pedidoCompraId, userId, status: "confirmado" },
    include: { produtos: true },
  });
  if (!pedido) {
    throw new Error("Pedido de compra não encontrado ou ainda não confirmado");
  }

  const valorTotal = pedido.produtos.reduce(
    (soma, produto) => soma + produto.custo * produto.quantidade * produto.multiplicador,
    0
  );
  const categoriaId = await resolverCategoriaCompraDeMercadoria(userId);
  const numeroDeParcelas = dados.numeroDeParcelas ?? 1;
  const competencia = pedido.dataConclusao ?? new Date();

  if (numeroDeParcelas === 1) {
    const chaveExterna = `pedido-compra:${pedidoCompraId}`;
    const lancamento = await prisma.lancamentoFinanceiro.upsert({
      where: { userId_chaveExterna: { userId, chaveExterna } },
      create: {
        userId,
        criadoPorId,
        tipo: TipoLancamento.DESPESA,
        descricao: `Compra de mercadoria — pedido #${pedidoCompraId}`,
        valor: valorTotal,
        categoriaId,
        contaFinanceiraId: dados.contaFinanceiraId ?? null,
        fornecedorId: pedido.fornecedorId,
        pedidoCompraId,
        competencia,
        vencimento: dados.vencimento,
        status: StatusLancamento.PREVISTO,
        origem: OrigemLancamento.PEDIDO_COMPRA,
        confianca: Confianca.CONFIRMADO,
        chaveExterna,
      },
      update: {},
    });
    return { lancamentos: [lancamento] };
  }

  const valores = dividirEmParcelas(valorTotal, numeroDeParcelas);
  const grupoParcelamentoId = crypto.randomUUID();
  const lancamentos = [];
  for (let i = 0; i < numeroDeParcelas; i++) {
    const chaveExterna = `pedido-compra:${pedidoCompraId}:parcela:${i + 1}`;
    const vencimento = somarMeses(dados.vencimento, i);
    const lancamento = await prisma.lancamentoFinanceiro.upsert({
      where: { userId_chaveExterna: { userId, chaveExterna } },
      create: {
        userId,
        criadoPorId,
        tipo: TipoLancamento.DESPESA,
        descricao: `Compra de mercadoria — pedido #${pedidoCompraId} (${i + 1}/${numeroDeParcelas})`,
        valor: valores[i],
        categoriaId,
        contaFinanceiraId: dados.contaFinanceiraId ?? null,
        fornecedorId: pedido.fornecedorId,
        pedidoCompraId,
        competencia,
        vencimento,
        status: StatusLancamento.PREVISTO,
        origem: OrigemLancamento.PEDIDO_COMPRA,
        confianca: Confianca.CONFIRMADO,
        grupoParcelamentoId,
        parcelaNumero: i + 1,
        parcelaTotal: numeroDeParcelas,
        chaveExterna,
      },
      update: {},
    });
    lancamentos.push(lancamento);
  }
  return { lancamentos };
}
