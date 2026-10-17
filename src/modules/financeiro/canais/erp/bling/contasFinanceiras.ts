import { OrigemLancamento, StatusLancamento, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BlingService, type BlingContaFinanceira } from "@/services/blingService";
import { seedPlanoContasPadrao } from "../../../lancamentos/planoContasPadrao";

const LIMITE_POR_PAGINA = 100;

export interface ResultadoIngestaoContasBling {
  processadas: number;
}

async function resolverCategoriaOutras(userId: string): Promise<string> {
  await seedPlanoContasPadrao(userId);
  const categoria = await prisma.categoriaFinanceira.findFirst({
    where: { userId, nome: "Outras", paiId: null },
    select: { id: true },
  });
  if (!categoria) {
    throw new Error('Categoria "Outras" não encontrada mesmo após o seed');
  }
  return categoria.id;
}

async function resolverCategoriaId(
  userId: string,
  categoriaOutrasId: string,
  mapaPorBlingId: Map<string, string>,
  blingCategoriaId: number | undefined
): Promise<string> {
  if (blingCategoriaId == null) return categoriaOutrasId;
  return mapaPorBlingId.get(String(blingCategoriaId)) ?? categoriaOutrasId;
}

async function resolverFornecedorId(userId: string, blingContatoId: number | undefined): Promise<string | null> {
  if (blingContatoId == null) return null;
  const fornecedor = await prisma.fornecedor.findFirst({
    where: { userId, blingContatoId: String(blingContatoId) },
    select: { id: true },
  });
  return fornecedor?.id ?? null;
}

async function ingerirContas(
  userId: string,
  blingAccountId: string,
  tipo: "pagar" | "receber"
): Promise<ResultadoIngestaoContasBling> {
  const categoriaOutrasId = await resolverCategoriaOutras(userId);
  const mapeamentos = await prisma.mapeamentoCategoriaBling.findMany({
    where: { userId },
    select: { blingCategoriaId: true, categoriaFinanceiraId: true },
  });
  const mapaPorBlingId = new Map(mapeamentos.map((m) => [m.blingCategoriaId, m.categoriaFinanceiraId]));

  let pagina = 1;
  let processadas = 0;

  while (true) {
    const contas: BlingContaFinanceira[] =
      tipo === "pagar"
        ? await BlingService.getContasPagar(blingAccountId, pagina, LIMITE_POR_PAGINA)
        : await BlingService.getContasReceber(blingAccountId, pagina, LIMITE_POR_PAGINA);

    if (contas.length === 0) break;

    for (const conta of contas) {
      const categoriaId = await resolverCategoriaId(userId, categoriaOutrasId, mapaPorBlingId, conta.categoria?.id);
      const fornecedorId = await resolverFornecedorId(userId, conta.contato?.id);
      const chaveExterna = `bling:${tipo}:${conta.id}`;

      const dadosComuns = {
        tipo: tipo === "pagar" ? TipoLancamento.DESPESA : TipoLancamento.RECEITA,
        descricao: conta.historico || `Bling #${conta.numeroDocumento ?? conta.id}`,
        valor: Math.round(conta.valor * 100),
        categoriaId,
        fornecedorId,
        competencia: conta.dataEmissao ? new Date(conta.dataEmissao) : new Date(conta.vencimento),
        vencimento: new Date(conta.vencimento),
        pagamento: conta.dataPagamento ? new Date(conta.dataPagamento) : null,
        status: conta.dataPagamento ? StatusLancamento.PAGO : StatusLancamento.PREVISTO,
        origem: OrigemLancamento.ERP,
      };

      await prisma.lancamentoFinanceiro.upsert({
        where: { userId_chaveExterna: { userId, chaveExterna } },
        create: { userId, criadoPorId: userId, chaveExterna, ...dadosComuns },
        update: dadosComuns,
      });
      processadas++;
    }

    if (contas.length < LIMITE_POR_PAGINA) break;
    pagina++;
  }

  return { processadas };
}

export async function ingerirContasAPagarBling(
  userId: string,
  blingAccountId: string
): Promise<ResultadoIngestaoContasBling> {
  return ingerirContas(userId, blingAccountId, "pagar");
}

export async function ingerirContasAReceberBling(
  userId: string,
  blingAccountId: string
): Promise<ResultadoIngestaoContasBling> {
  return ingerirContas(userId, blingAccountId, "receber");
}

export async function sincronizarContasFinanceirasBling(
  userId: string,
  blingAccountId: string
): Promise<{ pagar: ResultadoIngestaoContasBling; receber: ResultadoIngestaoContasBling }> {
  const config = await prisma.configuracaoGeral.findUnique({
    where: { userId },
    select: { blingContasAtivo: true },
  });
  if (!config?.blingContasAtivo) {
    return { pagar: { processadas: 0 }, receber: { processadas: 0 } };
  }

  const [pagar, receber] = await Promise.all([
    ingerirContasAPagarBling(userId, blingAccountId),
    ingerirContasAReceberBling(userId, blingAccountId),
  ]);
  return { pagar, receber };
}
