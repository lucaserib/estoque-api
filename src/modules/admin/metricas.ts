import { PapelMensagemIa, StatusIaAssinatura, StatusVendaCanal, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { fimDoDia, inicioDoDia, inicioDoMes } from "@/modules/financeiro/dominio/periodo";

const DIA_MS = 24 * 60 * 60 * 1000;
const STATUS_VENDA_VALIDA = [StatusVendaCanal.PAGA, StatusVendaCanal.DEVOLVIDA_PARCIAL, StatusVendaCanal.EM_MEDIACAO];

export interface PontoSerie {
  dia: string;
  valor: number;
}

export interface CustoIaPorConta {
  contaId: string;
  nome: string | null;
  email: string;
  custoCentavos: number;
  chamadas: number;
}

export interface MetricasIa {
  assinantes: number;
  emTeste: number;
  liberadasManual: number;
  testesIniciados: number;
  conversaoTeste: number | null;
  pedidosPendentes: number;
  analises30d: number;
  receitaMensal: number;
  custoMesCentavos: number;
  custoSemPreco: number;
  margemMensal: number;
  custoPorConta: CustoIaPorConta[];
  mensagensPorDia: PontoSerie[];
  feedbacks30d: number;
  taxaPositiva: number | null;
  chamadas24h: number;
  errosProvedor24h: number;
}

export interface MetricasPlataforma {
  geradoEm: string;
  contas: { total: number; novas7d: number; novas30d: number; ativas30d: number };
  usuarios: { total: number; membros: number; novos7d: number };
  assinaturas: {
    emTeste: number;
    ativas: number;
    inadimplentes: number;
    canceladas: number;
    mensais: number;
    anuais: number;
    mrr: number;
    testesVencendo7d: number;
    conversao: number | null;
  };
  ia: MetricasIa;
  integracoes: { contasComMl: number; contasComBling: number; mlInativas: number; blingInativas: number };
  operacao: {
    pedidos30d: number;
    gmv30d: number;
    produtosCadastrados: number;
    anunciosAtivos: number;
    notasFiscais30d: number;
  };
  saude: {
    webhooksMl24h: number;
    webhooksMlComErro24h: number;
    webhooksBling24h: number;
    webhooksBlingComErro24h: number;
    tarefasComErro: number;
    tarefasPendentes: number;
    vendasComFalhaDetalhe: number;
  };
  series: { cadastros: PontoSerie[]; gmv: PontoSerie[]; pedidos: PontoSerie[] };
}

function seriePorDia(desde: Date, ate: Date, registros: Array<{ data: Date; valor: number }>): PontoSerie[] {
  const baldes = new Map<string, number>();
  for (const r of registros) {
    const chave = inicioDoDia(r.data).toISOString();
    baldes.set(chave, (baldes.get(chave) ?? 0) + r.valor);
  }
  const pontos: PontoSerie[] = [];
  let cursor = inicioDoDia(desde);
  while (cursor <= ate) {
    const chave = cursor.toISOString();
    pontos.push({ dia: chave, valor: baldes.get(chave) ?? 0 });
    cursor = new Date(fimDoDia(cursor).getTime() + 1);
  }
  return pontos;
}

export function mrrEstimado(
  assinaturas: Array<{ status: SubscriptionStatus; plan: SubscriptionPlan | null; precoContratadoCentavos?: number | null }>,
  precos: { mensalCentavos: number; anualCentavos: number }
): {
  mrr: number;
  receitaIa: number;
} {
  let mrrCentavos = 0;
  for (const a of assinaturas) {
    if (a.status !== SubscriptionStatus.ACTIVE) continue;
    if (a.plan === SubscriptionPlan.ANNUAL) mrrCentavos += (a.precoContratadoCentavos ?? precos.anualCentavos) / 12;
    else if (a.plan === SubscriptionPlan.MONTHLY) mrrCentavos += a.precoContratadoCentavos ?? precos.mensalCentavos;
  }
  return { mrr: Math.round(mrrCentavos) / 100, receitaIa: 0 };
}

export async function calcularMetricasPlataforma(agora: Date = new Date()): Promise<MetricasPlataforma> {
  const ha7 = new Date(agora.getTime() - 7 * DIA_MS);
  const ha30 = new Date(agora.getTime() - 30 * DIA_MS);
  const ha24h = new Date(agora.getTime() - DIA_MS);
  const em7 = new Date(agora.getTime() + 7 * DIA_MS);

  const [
    contasTotal,
    contasNovas7d,
    contasNovas30d,
    usuariosTotal,
    membros,
    usuariosNovos7d,
    assinaturas,
    contasComVendas30d,
    analises30d,
    contasMl,
    contasBling,
    vendas30d,
    produtosCadastrados,
    anunciosAtivos,
    notasFiscais30d,
    webhooksMl24h,
    webhooksMlComErro24h,
    webhooksBling24h,
    webhooksBlingComErro24h,
    tarefasComErro,
    tarefasPendentes,
    vendasComFalhaDetalhe,
    cadastros30d,
  ] = await Promise.all([
    prisma.user.count({ where: { contaId: null } }),
    prisma.user.count({ where: { contaId: null, createdAt: { gte: ha7 } } }),
    prisma.user.count({ where: { contaId: null, createdAt: { gte: ha30 } } }),
    prisma.user.count(),
    prisma.user.count({ where: { contaId: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: ha7 } } }),
    prisma.subscription.findMany({
      select: {
        status: true,
        plan: true,
        precoContratadoCentavos: true,
        iaStatus: true,
        iaLiberadaManual: true,
        iaTesteIniciadoEm: true,
        iaSolicitadaEm: true,
        trialEndsAt: true,
      },
    }),
    prisma.vendaCanal.groupBy({ by: ["userId"], where: { dataVenda: { gte: ha30 } } }),
    prisma.analiseIa.count({ where: { createdAt: { gte: ha30 } } }),
    prisma.mercadoLivreAccount.findMany({ select: { userId: true, isActive: true } }),
    prisma.blingAccount.findMany({ select: { userId: true, isActive: true } }),
    prisma.vendaCanal.findMany({
      where: { dataVenda: { gte: ha30 }, status: { in: STATUS_VENDA_VALIDA } },
      select: { dataVenda: true, faturamentoBruto: true, valorEstornado: true },
    }),
    prisma.produto.count({ where: { ativo: true } }),
    prisma.produtoMercadoLivre.count({ where: { mlStatus: "active" } }),
    prisma.notaFiscalVenda.count({ where: { dataEmissao: { gte: ha30 } } }),
    prisma.mercadoLivreWebhook.count({ where: { receivedAt: { gte: ha24h } } }),
    prisma.mercadoLivreWebhook.count({ where: { receivedAt: { gte: ha24h }, error: { not: null } } }),
    prisma.blingWebhookEvent.count({ where: { recebidoEm: { gte: ha24h } } }),
    prisma.blingWebhookEvent.count({ where: { recebidoEm: { gte: ha24h }, erro: { not: null } } }),
    prisma.tarefaSincronizacaoFinanceira.count({ where: { status: "ERRO" } }),
    prisma.tarefaSincronizacaoFinanceira.count({ where: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] } } }),
    prisma.vendaCanal.count({ where: { enriquecidoEm: null, enriquecimentoErro: { not: null } } }),
    prisma.user.findMany({ where: { contaId: null, createdAt: { gte: ha30 } }, select: { createdAt: true } }),
  ]);

  const contar = (status: SubscriptionStatus) => assinaturas.filter((a) => a.status === status).length;
  const ativas = contar(SubscriptionStatus.ACTIVE);
  const canceladas = contar(SubscriptionStatus.CANCELED);
  const configuracao = await obterConfiguracaoComercial();
  const { mrr } = mrrEstimado(assinaturas, {
    mensalCentavos: configuracao.precoMensalCentavos,
    anualCentavos: configuracao.precoAnualCentavos,
  });
  const ia = await calcularMetricasIa(agora, assinaturas, analises30d);

  const donosMl = new Set(contasMl.map((c) => c.userId));
  const donosBling = new Set(contasBling.map((c) => c.userId));

  return {
    geradoEm: agora.toISOString(),
    contas: {
      total: contasTotal,
      novas7d: contasNovas7d,
      novas30d: contasNovas30d,
      ativas30d: contasComVendas30d.length,
    },
    usuarios: { total: usuariosTotal, membros, novos7d: usuariosNovos7d },
    assinaturas: {
      emTeste: contar(SubscriptionStatus.TRIALING),
      ativas,
      inadimplentes: contar(SubscriptionStatus.PAST_DUE),
      canceladas,
      mensais: assinaturas.filter((a) => a.status === SubscriptionStatus.ACTIVE && a.plan === SubscriptionPlan.MONTHLY).length,
      anuais: assinaturas.filter((a) => a.status === SubscriptionStatus.ACTIVE && a.plan === SubscriptionPlan.ANNUAL).length,
      mrr,
      testesVencendo7d: assinaturas.filter(
        (a) => a.status === SubscriptionStatus.TRIALING && a.trialEndsAt >= agora && a.trialEndsAt <= em7
      ).length,
      conversao: assinaturas.length > 0 ? ativas / assinaturas.length : null,
    },
    ia,
    integracoes: {
      contasComMl: donosMl.size,
      contasComBling: donosBling.size,
      mlInativas: contasMl.filter((c) => !c.isActive).length,
      blingInativas: contasBling.filter((c) => !c.isActive).length,
    },
    operacao: {
      pedidos30d: vendas30d.length,
      gmv30d: vendas30d.reduce((t, v) => t + v.faturamentoBruto - v.valorEstornado, 0),
      produtosCadastrados,
      anunciosAtivos,
      notasFiscais30d,
    },
    saude: {
      webhooksMl24h,
      webhooksMlComErro24h,
      webhooksBling24h,
      webhooksBlingComErro24h,
      tarefasComErro,
      tarefasPendentes,
      vendasComFalhaDetalhe,
    },
    series: {
      cadastros: seriePorDia(ha30, agora, cadastros30d.map((u) => ({ data: u.createdAt, valor: 1 }))),
      gmv: seriePorDia(ha30, agora, vendas30d.map((v) => ({ data: v.dataVenda, valor: v.faturamentoBruto - v.valorEstornado }))),
      pedidos: seriePorDia(ha30, agora, vendas30d.map((v) => ({ data: v.dataVenda, valor: 1 }))),
    },
  };
}

async function calcularMetricasIa(
  agora: Date,
  assinaturas: Array<{
    userId?: string;
    iaStatus: StatusIaAssinatura;
    iaLiberadaManual: boolean;
    iaTesteIniciadoEm: Date | null;
    iaSolicitadaEm: Date | null;
  }>,
  analises30d: number
): Promise<MetricasIa> {
  const ha30 = new Date(agora.getTime() - 30 * DIA_MS);
  const ha24h = new Date(agora.getTime() - DIA_MS);
  const inicioMes = inicioDoMes(agora);

  const [custoMes, semPreco, custoPorContaBruto, perguntas30d, feedbacks, positivos, chamadas24h, erros24h] =
    await Promise.all([
      prisma.usoIa.aggregate({ where: { createdAt: { gte: inicioMes } }, _sum: { custoCentavos: true } }),
      prisma.usoIa.count({ where: { createdAt: { gte: inicioMes }, custoCentavos: null, sucesso: true } }),
      prisma.usoIa.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: inicioMes } },
        _sum: { custoCentavos: true },
        _count: { _all: true },
        orderBy: { _sum: { custoCentavos: "desc" } },
        take: 10,
      }),
      prisma.mensagemIa.findMany({
        where: { papel: PapelMensagemIa.USUARIO, createdAt: { gte: ha30 } },
        select: { createdAt: true },
      }),
      prisma.mensagemIa.count({ where: { createdAt: { gte: ha30 }, util: { not: null } } }),
      prisma.mensagemIa.count({ where: { createdAt: { gte: ha30 }, util: true } }),
      prisma.usoIa.count({ where: { createdAt: { gte: ha24h } } }),
      prisma.usoIa.count({ where: { createdAt: { gte: ha24h }, sucesso: false, codigoErro: { not: "CANCELADO" } } }),
    ]);

  const donos = await prisma.user.findMany({
    where: { id: { in: custoPorContaBruto.map((c) => c.userId) } },
    select: { id: true, name: true, email: true },
  });
  const donoPorId = new Map(donos.map((d) => [d.id, d]));

  const [contasComTesteVigente, testesIniciados, compradoras30d, comprasPendentes, receitaCreditos] = await Promise.all([
    prisma.loteCreditoIa.findMany({
      where: { origem: "TESTE", validoAte: { gt: agora } },
      select: { contaId: true },
      distinct: ["contaId"],
    }),
    prisma.loteCreditoIa.findMany({ where: { origem: "TESTE" }, select: { contaId: true }, distinct: ["contaId"] }),
    prisma.compraCreditoIa.findMany({
      where: { status: "APROVADA", aprovadaEm: { gte: ha30 } },
      select: { contaId: true },
      distinct: ["contaId"],
    }),
    prisma.compraCreditoIa.count({ where: { status: "PENDENTE", expiraEm: { gt: agora } } }),
    prisma.pagamentoPlataforma.aggregate({
      where: { tipo: "CREDITO_IA", status: "approved", aprovadoEm: { gte: inicioMes } },
      _sum: { valorCentavos: true },
    }),
  ]);
  const jaCompraram = new Set(
    (await prisma.compraCreditoIa.findMany({ where: { status: "APROVADA" }, select: { contaId: true }, distinct: ["contaId"] })).map(
      (c) => c.contaId
    )
  );
  const convertidos = testesIniciados.filter((t) => jaCompraram.has(t.contaId)).length;
  const custoMesCentavos = custoMes._sum.custoCentavos ?? 0;
  const receitaMesReais = (receitaCreditos._sum.valorCentavos ?? 0) / 100;

  return {
    assinantes: compradoras30d.length,
    emTeste: contasComTesteVigente.length,
    liberadasManual: assinaturas.filter((a) => a.iaLiberadaManual).length,
    testesIniciados: testesIniciados.length,
    conversaoTeste: testesIniciados.length > 0 ? convertidos / testesIniciados.length : null,
    pedidosPendentes: comprasPendentes,
    analises30d,
    receitaMensal: receitaMesReais,
    custoMesCentavos,
    custoSemPreco: semPreco,
    margemMensal: Math.round((receitaMesReais - custoMesCentavos / 100) * 100) / 100,
    custoPorConta: custoPorContaBruto.map((c) => ({
      contaId: c.userId,
      nome: donoPorId.get(c.userId)?.name ?? null,
      email: donoPorId.get(c.userId)?.email ?? "—",
      custoCentavos: c._sum.custoCentavos ?? 0,
      chamadas: c._count._all,
    })),
    mensagensPorDia: seriePorDia(ha30, agora, perguntas30d.map((m) => ({ data: m.createdAt, valor: 1 }))),
    feedbacks30d: feedbacks,
    taxaPositiva: feedbacks > 0 ? positivos / feedbacks : null,
    chamadas24h,
    errosProvedor24h: erros24h,
  };
}

