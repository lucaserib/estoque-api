import { prisma } from "@/lib/prisma";
import { withCache, createCacheKey } from "@/lib/cache";
import { calcularTodasPendencias } from "@/services/pendenciasService";
import { obterStatusCatalogo } from "@/modules/catalogo/sincronizacao";
import { BlingService, BlingEscopoError } from "@/services/blingService";

export type StatusEtapa = "feito" | "pendente" | "bloqueado" | "atencao";

export interface AcaoEtapa {
  rotulo: string;
  href: string;
}

export interface EtapaOnboarding {
  id: number;
  titulo: string;
  porque: string;
  status: StatusEtapa;
  progresso?: { feito: number; total: number };
  acao: AcaoEtapa;
  minutosEstimados: number;
  /** Etapas que não têm como ser "feitas" de forma binária (ex.: instalar no celular) podem ser puladas. */
  pulavel: boolean;
}

export type Nivel = "Caixa" | "Prateleira" | "Depósito" | "Centro de Distribuição";

export interface ResultadoOnboarding {
  etapas: EtapaOnboarding[];
  pontuacao: number;
  nivel: Nivel;
}

const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

async function etapaMercadoLivre(contaId: string): Promise<EtapaOnboarding> {
  const conta = await prisma.mercadoLivreAccount.findFirst({
    where: { userId: contaId, isActive: true },
    select: { id: true, nickname: true },
  });

  return {
    id: 1,
    titulo: "Conectar o Mercado Livre",
    porque: "Sem isso o Skubo não enxerga seus anúncios, preços nem vendas.",
    status: conta ? "feito" : "pendente",
    acao: conta
      ? { rotulo: "Ver conexão", href: "/integracoes" }
      : { rotulo: "Conectar", href: "/integracoes" },
    minutosEstimados: 2,
    pulavel: false,
  };
}

async function etapaBling(contaId: string): Promise<EtapaOnboarding> {
  const conta = await prisma.blingAccount.findFirst({
    where: { userId: contaId, isActive: true },
  });

  if (!conta) {
    return {
      id: 2,
      titulo: "Conectar o Bling",
      porque: "O Bling é de onde vem o custo e o estoque dos seus produtos.",
      status: "pendente",
      acao: { rotulo: "Conectar", href: "/integracoes" },
      minutosEstimados: 2,
      pulavel: true,
    };
  }

  try {
    await BlingService.getDeposits(conta.id);
    return {
      id: 2,
      titulo: "Conectar o Bling",
      porque: "O Bling é de onde vem o custo e o estoque dos seus produtos.",
      status: "feito",
      acao: { rotulo: "Ver conexão", href: "/integracoes" },
      minutosEstimados: 2,
      pulavel: true,
    };
  } catch (erro) {
    const ehEscopo = erro instanceof BlingEscopoError;
    return {
      id: 2,
      titulo: "Conectar o Bling",
      porque: ehEscopo
        ? erro.message
        : "O Bling conectou, mas uma chamada de teste falhou — tente reconectar.",
      status: "atencao",
      acao: { rotulo: "Resolver no Bling", href: "/integracoes" },
      minutosEstimados: 3,
      pulavel: true,
    };
  }
}

async function etapaNotificacoes(contaId: string): Promise<EtapaOnboarding> {
  const [ultimoWebhookMl, contaBling] = await Promise.all([
    prisma.mercadoLivreWebhook.findFirst({
      where: { mercadoLivreAccount: { userId: contaId } },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    }),
    prisma.blingAccount.findFirst({ where: { userId: contaId, isActive: true }, select: { blingCompanyId: true } }),
  ]);

  const ultimoWebhookBling = contaBling?.blingCompanyId
    ? await prisma.blingWebhookEvent.findFirst({
        where: { companyId: contaBling.blingCompanyId },
        orderBy: { recebidoEm: "desc" },
        select: { recebidoEm: true },
      })
    : null;

  const agora = Date.now();
  const mlOk = !!ultimoWebhookMl && agora - ultimoWebhookMl.receivedAt.getTime() < VINTE_QUATRO_HORAS_MS;
  const blingOk =
    !contaBling || (!!ultimoWebhookBling && agora - ultimoWebhookBling.recebidoEm.getTime() < VINTE_QUATRO_HORAS_MS);

  return {
    id: 3,
    titulo: "Receber notificações",
    porque: "São elas que avisam o Skubo na hora de uma venda ou mudança de estoque, sem esperar o próximo horário de sincronização.",
    status: mlOk && blingOk ? "feito" : "atencao",
    acao: { rotulo: "Ver URLs de notificação", href: "/integracoes" },
    minutosEstimados: 3,
    pulavel: true,
  };
}

async function etapaCatalogo(contaId: string): Promise<EtapaOnboarding> {
  const status = await obterStatusCatalogo(contaId);
  const feito = status.concluidoEm != null;

  return {
    id: 4,
    titulo: "Trazer o catálogo",
    porque: "Sincroniza seus produtos, estoque e anúncios de uma vez — é a base de tudo que vem depois.",
    status: feito ? "feito" : status.emAndamento ? "atencao" : "pendente",
    acao: { rotulo: feito ? "Sincronizar de novo" : "Trazer agora", href: "/integracoes?sincronizar=1" },
    minutosEstimados: 5,
    pulavel: false,
  };
}

async function etapaVincularAnuncios(contaId: string): Promise<EtapaOnboarding> {
  const [ativos, vinculados] = await Promise.all([
    prisma.produtoMercadoLivre.count({
      where: { mercadoLivreAccount: { userId: contaId }, mlStatus: "active" },
    }),
    prisma.produtoMercadoLivre.count({
      where: { mercadoLivreAccount: { userId: contaId }, mlStatus: "active", produtoId: { not: null } },
    }),
  ]);

  const feito = ativos > 0 && vinculados === ativos;

  return {
    id: 5,
    titulo: "Vincular anúncios",
    porque: "Sem o anúncio vinculado ao produto, a venda não tem custo nem desconta estoque certo.",
    status: ativos === 0 ? "pendente" : feito ? "feito" : "pendente",
    progresso: { feito: vinculados, total: ativos },
    acao: { rotulo: "Vincular anúncios", href: "/mercado-livre/produtos?status=active&semVinculo=1" },
    minutosEstimados: 10,
    pulavel: false,
  };
}

async function etapaCustos(contaId: string): Promise<EtapaOnboarding> {
  const pendencias = await withCache(
    createCacheKey("pendencias", contaId),
    () => calcularTodasPendencias(contaId),
    "pendencias"
  );

  const total = pendencias.length;
  const comCusto = pendencias.filter((p) => !p.pendencias.some((x) => x.codigo === "SEM_CUSTO")).length;

  return {
    id: 6,
    titulo: "Custos dos produtos",
    porque: "Sem custo não tem como calcular margem — é o número que mais pesa no lucro.",
    status: total === 0 ? "pendente" : comCusto === total ? "feito" : "pendente",
    progresso: { feito: comCusto, total },
    acao: { rotulo: "Preencher custos", href: "/produtos/pendentes?codigo=SEM_CUSTO" },
    minutosEstimados: 15,
    pulavel: false,
  };
}

async function etapaFornecedores(contaId: string): Promise<EtapaOnboarding> {
  const pendencias = await withCache(
    createCacheKey("pendencias", contaId),
    () => calcularTodasPendencias(contaId),
    "pendencias"
  );

  const produtos = await prisma.produto.findMany({
    where: { userId: contaId, ativo: true, isKit: false },
    select: { id: true },
  });
  const idsNaoKit = new Set(produtos.map((p) => p.id));
  const relevantes = pendencias.filter((p) => idsNaoKit.has(p.produtoId));
  const codigosBloqueio = new Set(["SEM_FORNECEDOR", "SEM_FORNECEDOR_PRINCIPAL", "SEM_PRAZO_FORNECEDOR"]);
  const completos = relevantes.filter((p) => !p.pendencias.some((x) => codigosBloqueio.has(x.codigo))).length;

  return {
    id: 7,
    titulo: "Fornecedores e prazos",
    porque: "O prazo de entrega do fornecedor principal é o que a reposição usa pra sugerir quando comprar.",
    status: relevantes.length === 0 ? "pendente" : completos === relevantes.length ? "feito" : "pendente",
    progresso: { feito: completos, total: relevantes.length },
    acao: { rotulo: "Cadastrar fornecedores", href: "/produtos/pendentes?codigo=SEM_FORNECEDOR" },
    minutosEstimados: 10,
    pulavel: false,
  };
}

async function etapaImpostos(contaId: string): Promise<EtapaOnboarding> {
  const config = await prisma.configuracaoGeral.findUnique({
    where: { userId: contaId },
    select: { aliquotaImposto: true, regimeTributario: true },
  });

  const feito = !!config && (config.aliquotaImposto > 0 || config.regimeTributario !== "SIMPLES");

  return {
    id: 8,
    titulo: "Impostos e modo de faturamento",
    porque: "Define a alíquota usada na margem e como o faturamento aparece nas suas telas (igual ao ML, ao Bling, ou com o frete do comprador).",
    status: feito ? "feito" : "pendente",
    acao: { rotulo: "Configurar", href: "/financeiro/configuracoes" },
    minutosEstimados: 3,
    pulavel: false,
  };
}

async function etapaDespesasFixas(contaId: string): Promise<EtapaOnboarding> {
  const total = await prisma.lancamentoFinanceiro.count({
    where: {
      userId: contaId,
      categoria: { grupoDre: "DESPESA_OPERACIONAL" },
    },
  });

  return {
    id: 9,
    titulo: "Despesas fixas",
    porque: "Aluguel, salários e ferramentas entram no lucro líquido e no ponto de equilíbrio — sem elas, o lucro líquido fica igual à margem de contribuição.",
    status: total > 0 ? "feito" : "pendente",
    acao: { rotulo: "Cadastrar despesas", href: "/financeiro/lancamentos?novo=despesa" },
    minutosEstimados: 10,
    pulavel: true,
  };
}

async function etapaMeta(contaId: string): Promise<EtapaOnboarding> {
  const config = await prisma.configuracaoGeral.findUnique({
    where: { userId: contaId },
    select: { metaFaturamentoMensal: true },
  });

  return {
    id: 10,
    titulo: "Meta do mês",
    porque: "Mostra o quanto falta pra bater o mês, direto na Visão geral.",
    status: config?.metaFaturamentoMensal != null ? "feito" : "pendente",
    acao: { rotulo: "Definir meta", href: "/financeiro/configuracoes" },
    minutosEstimados: 1,
    pulavel: true,
  };
}

async function etapaSaldoMercadoPago(contaId: string): Promise<EtapaOnboarding> {
  const conta = await prisma.contaFinanceira.findFirst({
    where: { userId: contaId, tipo: "CARTEIRA_MARKETPLACE", automatica: true },
    select: { saldoInicial: true },
  });

  return {
    id: 11,
    titulo: "Saldo do Mercado Pago",
    porque: "O saldo inicial é a base pra calcular o caixa projetado — só precisa informar uma vez.",
    status: !conta ? "pendente" : conta.saldoInicial !== 0 ? "feito" : "atencao",
    acao: { rotulo: "Informar saldo", href: "/financeiro/fluxo-de-caixa" },
    minutosEstimados: 1,
    pulavel: true,
  };
}

async function etapaInstalarCelular(contaId: string): Promise<EtapaOnboarding> {
  const progresso = await prisma.onboardingProgresso.findUnique({
    where: { userId: contaId },
    select: { etapasPuladas: true },
  });
  const confirmado = progresso?.etapasPuladas.includes("12_instalado") ?? false;

  return {
    id: 12,
    titulo: "Instalar no celular",
    porque: "Com o Skubo instalado, dá pra ver o resultado do dia sem abrir o navegador.",
    status: confirmado ? "feito" : "pendente",
    acao: { rotulo: "Ver como instalar", href: "/configuracoes-gerais?instalar=1" },
    minutosEstimados: 1,
    pulavel: true,
  };
}

const CALCULADORAS: Array<(contaId: string) => Promise<EtapaOnboarding>> = [
  etapaMercadoLivre,
  etapaBling,
  etapaNotificacoes,
  etapaCatalogo,
  etapaVincularAnuncios,
  etapaCustos,
  etapaFornecedores,
  etapaImpostos,
  etapaDespesasFixas,
  etapaMeta,
  etapaSaldoMercadoPago,
  etapaInstalarCelular,
];

function aplicarBloqueios(etapas: EtapaOnboarding[], puladas: Set<number>): EtapaOnboarding[] {
  let anteriorLiberada = true;
  return etapas.map((etapa) => {
    const concluidaOuPulada = etapa.status === "feito" || puladas.has(etapa.id);
    const resultado: EtapaOnboarding =
      !anteriorLiberada && etapa.status !== "feito" ? { ...etapa, status: "bloqueado" } : etapa;
    anteriorLiberada = concluidaOuPulada;
    return resultado;
  });
}

function calcularNivel(etapas: EtapaOnboarding[], puladas: Set<number>): Nivel {
  const feita = (id: number) => etapas.find((e) => e.id === id)?.status === "feito" || puladas.has(id);
  const todas = etapas.every((e) => e.status === "feito" || puladas.has(e.id));

  if (todas) return "Centro de Distribuição";
  if (feita(6) && feita(7)) return "Depósito";
  if (feita(5)) return "Prateleira";
  return "Caixa";
}

export async function calcularEtapas(contaId: string): Promise<ResultadoOnboarding> {
  return withCache(
    createCacheKey("onboarding", contaId),
    async () => {
      const [progresso, ...brutas] = await Promise.all([
        prisma.onboardingProgresso.findUnique({ where: { userId: contaId }, select: { etapasPuladas: true } }),
        ...CALCULADORAS.map((calc) => calc(contaId)),
      ]);

      const puladas = new Set((progresso?.etapasPuladas ?? []).map((s) => Number(s.split("_")[0])).filter((n) => !Number.isNaN(n)));

      const etapas = aplicarBloqueios(brutas, puladas);
      const concluidasOuPuladas = etapas.filter((e) => e.status === "feito" || puladas.has(e.id)).length;
      const pontuacao = Math.round((concluidasOuPuladas / etapas.length) * 100);

      return {
        etapas,
        pontuacao,
        nivel: calcularNivel(etapas, puladas),
      };
    },
    "onboarding"
  );
}
