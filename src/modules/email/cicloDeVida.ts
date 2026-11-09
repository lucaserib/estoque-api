import type { AutomacaoEmail, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/modules/clientes/eventos";
import { garantirAutomacoes, dispararAutomacao, type VariaveisAutomacao } from "./automacoes";
import { dataBR, reais } from "./modelos/tipos";

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const JANELA_MS = 3 * DIA_MS;

export interface Candidato {
  contaId: string;
  sufixo?: string;
  variaveis?: VariaveisAutomacao;
  notificacao?: { tipo: NotificationType; titulo: string; corpo: string; link: string };
}

type Seletor = (automacao: AutomacaoEmail, agora: Date) => Promise<Candidato[]>;

function janela(agora: Date, atrasoMs: number) {
  return { lte: new Date(agora.getTime() - atrasoMs), gte: new Date(agora.getTime() - atrasoMs - JANELA_MS) };
}

async function contasCriadasEntre(intervalo: { lte: Date; gte: Date }): Promise<string[]> {
  const eventos = await prisma.eventoProduto.findMany({
    where: { nome: "CONTA_CRIADA", createdAt: intervalo },
    select: { contaId: true },
    take: 500,
  });
  return eventos.map((e) => e.contaId);
}

async function semEvento(contas: string[], nome: string): Promise<string[]> {
  if (contas.length === 0) return [];
  const com = await prisma.eventoProduto.findMany({ where: { contaId: { in: contas }, nome }, select: { contaId: true } });
  const conjunto = new Set(com.map((e) => e.contaId));
  return contas.filter((c) => !conjunto.has(c));
}

async function comEventoEntre(nome: string, intervalo: { lte: Date; gte: Date }): Promise<string[]> {
  const eventos = await prisma.eventoProduto.findMany({ where: { nome, createdAt: intervalo }, select: { contaId: true }, take: 500 });
  return [...new Set(eventos.map((e) => e.contaId))];
}

async function emTeste(contas: string[], agora: Date): Promise<string[]> {
  if (contas.length === 0) return [];
  const assinaturas = await prisma.subscription.findMany({
    where: { userId: { in: contas }, status: "TRIALING", trialEndsAt: { gt: agora } },
    select: { userId: true },
  });
  return assinaturas.map((a) => a.userId);
}

const SELETORES: Record<string, Seletor> = {
  "conectar-ml": async (automacao, agora) => {
    const contas = await contasCriadasEntre(janela(agora, automacao.atrasoHoras * HORA_MS));
    return (await semEvento(contas, "ML_CONECTADO")).map((contaId) => ({ contaId }));
  },
  "conectar-bling": async (automacao, agora) => {
    const contas = await comEventoEntre("ML_CONECTADO", janela(agora, automacao.atrasoHoras * HORA_MS));
    return (await semEvento(contas, "BLING_CONECTADO")).map((contaId) => ({ contaId }));
  },
  "primeira-reposicao": async (automacao, agora) => {
    const contas = await comEventoEntre("PRIMEIRA_SINCRONIZACAO", janela(agora, automacao.atrasoHoras * HORA_MS));
    return (await semEvento(contas, "PRIMEIRA_REPOSICAO_VISTA")).map((contaId) => ({ contaId }));
  },
  "ia-perguntas-gratis": async (automacao, agora) => {
    const contas = await contasCriadasEntre(janela(agora, automacao.atrasoHoras * HORA_MS));
    const ativas = await emTeste(await semEvento(contas, "PRIMEIRA_PERGUNTA_IA"), agora);
    const comSaldo = await prisma.loteCreditoIa.findMany({
      where: { contaId: { in: ativas }, validoAte: { gt: agora }, quantidadeRestante: { gt: 0 } },
      select: { contaId: true },
      distinct: ["contaId"],
    });
    return comSaldo.map(({ contaId }) => ({ contaId }));
  },
  "teste-acabando": async (_automacao, agora) => {
    const assinaturas = await prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: { gt: agora, lte: new Date(agora.getTime() + 2 * DIA_MS) } },
      select: { userId: true, trialEndsAt: true },
      take: 500,
    });
    return assinaturas.map((a) => ({
      contaId: a.userId,
      sufixo: a.trialEndsAt.toISOString().slice(0, 10),
      variaveis: { data_fim_teste: dataBR(a.trialEndsAt) },
      notificacao: {
        tipo: "ASSINATURA",
        titulo: "Seu teste termina em breve",
        corpo: `O teste grátis termina em ${dataBR(a.trialEndsAt)}. Assinando agora, a cobrança só começa no fim do teste.`,
        link: "/assinatura",
      },
    }));
  },
  "teste-terminou": async (automacao, agora) => {
    const assinaturas = await prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: janela(agora, automacao.atrasoHoras * HORA_MS) },
      select: { userId: true, trialEndsAt: true },
      take: 500,
    });
    for (const a of assinaturas) await registrarEvento(a.userId, "TESTE_TERMINOU");
    return assinaturas.map((a) => ({
      contaId: a.userId,
      sufixo: a.trialEndsAt.toISOString().slice(0, 10),
      notificacao: {
        tipo: "ASSINATURA",
        titulo: "Seu teste terminou",
        corpo: "Seus dados continuam guardados. Assine para continuar usando o Skubo.",
        link: "/assinatura",
      },
    }));
  },
  "volte-3": async (automacao, agora) => {
    const assinaturas = await prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: janela(agora, automacao.atrasoHoras * HORA_MS) },
      select: { userId: true },
      take: 500,
    });
    return assinaturas.map((a) => ({ contaId: a.userId }));
  },
  "volte-14": async (automacao, agora) => {
    const assinaturas = await prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: janela(agora, automacao.atrasoHoras * HORA_MS) },
      select: { userId: true },
      take: 500,
    });
    return assinaturas.map((a) => ({ contaId: a.userId }));
  },
  "pagamento-falhou": async (automacao, agora) => {
    const falhas = await prisma.eventoProduto.findMany({
      where: { nome: "PAGAMENTO_FALHOU", createdAt: janela(agora, automacao.atrasoHoras * HORA_MS) },
      select: { id: true, contaId: true },
      take: 500,
    });
    const ainda = await prisma.subscription.findMany({
      where: { userId: { in: falhas.map((f) => f.contaId) }, status: "PAST_DUE" },
      select: { userId: true },
    });
    const pendentes = new Set(ainda.map((a) => a.userId));
    return falhas
      .filter((f) => pendentes.has(f.contaId))
      .map((f) => ({
        contaId: f.contaId,
        sufixo: `lembrete:${f.id}`,
        notificacao: {
          tipo: "ASSINATURA",
          titulo: "O pagamento ainda não passou",
          corpo: "Atualize o cartão no Mercado Pago para não perder o acesso.",
          link: "/assinatura",
        },
      }));
  },
  "renovacao-anual": async (_automacao, agora) => {
    const assinaturas = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        plan: "ANNUAL",
        OR: [
          { proximaCobrancaEm: { gte: new Date(agora.getTime() + 13 * DIA_MS), lte: new Date(agora.getTime() + 15 * DIA_MS) } },
          {
            proximaCobrancaEm: null,
            currentPeriodEnd: { gte: new Date(agora.getTime() + 13 * DIA_MS), lte: new Date(agora.getTime() + 15 * DIA_MS) },
          },
        ],
      },
      select: { userId: true, proximaCobrancaEm: true, currentPeriodEnd: true, precoContratadoCentavos: true },
      take: 500,
    });
    return assinaturas.map((a) => {
      const data = a.proximaCobrancaEm ?? a.currentPeriodEnd!;
      return {
        contaId: a.userId,
        sufixo: data.toISOString().slice(0, 10),
        variaveis: { data_renovacao: dataBR(data), valor: a.precoContratadoCentavos ? reais(a.precoContratadoCentavos) : "o valor do plano" },
        notificacao: {
          tipo: "ASSINATURA",
          titulo: "Renovação anual em 15 dias",
          corpo: `Sua assinatura anual renova em ${dataBR(data)}.`,
          link: "/assinatura",
        },
      };
    });
  },
};

export const AUTOMACOES_POR_TEMPO = Object.keys(SELETORES);

export interface ResultadoCicloDeVida {
  automacoes: number;
  candidatos: number;
  enviados: number;
  ignorados: number;
}

export async function processarCicloDeVida(agora: Date = new Date(), orcamentoMs = 45_000): Promise<ResultadoCicloDeVida> {
  const prazo = Date.now() + orcamentoMs;
  await garantirAutomacoes();
  const automacoes = await prisma.automacaoEmail.findMany({ where: { ativo: true, chave: { in: AUTOMACOES_POR_TEMPO } } });
  const resultado: ResultadoCicloDeVida = { automacoes: automacoes.length, candidatos: 0, enviados: 0, ignorados: 0 };

  for (const automacao of automacoes) {
    if (Date.now() > prazo) break;
    const candidatos = await SELETORES[automacao.chave](automacao, agora);
    resultado.candidatos += candidatos.length;
    if (candidatos.length === 0) continue;

    const donos = await prisma.user.findMany({
      where: { id: { in: candidatos.map((c) => c.contaId) }, contaId: null, bloqueadoEm: null },
      select: { id: true, email: true },
    });
    const porId = new Map(donos.map((d) => [d.id, d]));

    for (const candidato of candidatos) {
      if (Date.now() > prazo) break;
      const dono = porId.get(candidato.contaId);
      if (!dono) {
        resultado.ignorados++;
        continue;
      }
      const chaveIdempotencia = `${automacao.chave}:${candidato.contaId}${candidato.sufixo ? `:${candidato.sufixo}` : ""}`;
      const envio = await dispararAutomacao({
        chave: automacao.chave,
        contaId: candidato.contaId,
        destinatario: dono,
        chaveIdempotencia,
        variaveis: candidato.variaveis,
      });
      if (!envio?.novo) {
        resultado.ignorados++;
        continue;
      }
      resultado.enviados++;
      if (candidato.notificacao) {
        await prisma.notification
          .create({
            data: {
              userId: dono.id,
              type: candidato.notificacao.tipo,
              title: candidato.notificacao.titulo,
              body: candidato.notificacao.corpo,
              link: candidato.notificacao.link,
            },
          })
          .catch(() => undefined);
      }
    }
  }
  return resultado;
}
