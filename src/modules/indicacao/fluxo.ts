import type { Indicacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { dispararAutomacao } from "@/modules/email/automacoes";
import { motivoDeFraude } from "./antifraude";
import { mascararNome } from "./comum";
import { aplicarCreditoNaHora, type FormaAplicada } from "./recompensa";

const DIA_MS = 24 * 60 * 60 * 1000;

function dataCurta(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(data);
}

const DESCRICAO_FORMA: Record<FormaAplicada, string> = {
  EXTENSAO_TESTE: "Seu teste grátis foi estendido.",
  EXTENSAO_ANUAL: "Sua assinatura anual foi estendida e a renovação vem com desconto.",
  PENDENTE: "Os dias viram desconto na próxima cobrança da sua assinatura.",
};

export async function aoConectarMercadoLivre(contaId: string, agora: Date = new Date()): Promise<void> {
  try {
    await prisma.indicacao.updateMany({
      where: { indicadoContaId: contaId, status: "CADASTRADO" },
      data: { status: "ATIVADO", ativadoEm: agora },
    });
    await prisma.indicacao.updateMany({
      where: { indicadoContaId: contaId, ativadoEm: null, status: { in: ["PAGOU", "EM_CARENCIA"] } },
      data: { ativadoEm: agora },
    });
  } catch (error) {
    console.error("[INDICACAO] Falha ao ativar:", error);
  }
}

export async function aoPagamentoAprovadoDoIndicado(contaId: string, pagamentoId: string, agora: Date = new Date()): Promise<void> {
  try {
    const indicacao = await prisma.indicacao.findUnique({ where: { indicadoContaId: contaId } });
    if (!indicacao || !["CADASTRADO", "ATIVADO"].includes(indicacao.status)) return;
    const { indicacao: regras } = await obterConfiguracaoComercial();
    const carenciaAte = new Date(agora.getTime() + regras.carenciaDias * DIA_MS);
    await prisma.indicacao.update({
      where: { id: indicacao.id },
      data: { status: "EM_CARENCIA", pagamentoId, pagouEm: agora, carenciaAte },
    });
    const indicado = await prisma.user.findUnique({ where: { id: contaId }, select: { name: true, email: true } });
    const faltaMl = regras.exigeMlConectado && !indicacao.ativadoEm;
    await prisma.notification
      .create({
        data: {
          userId: indicacao.indicadorContaId,
          type: "INDICACAO",
          title: "Sua indicação assinou o Skubo",
          body: faltaMl
            ? `${mascararNome(indicado?.name, indicado?.email)} assinou. A recompensa sai depois da carência, quando a loja conectar o Mercado Livre.`
            : `${mascararNome(indicado?.name, indicado?.email)} assinou. Seus ${indicacao.diasRecompensa} dias grátis saem a partir de ${dataCurta(carenciaAte)}.`,
          link: "/indique",
        },
      })
      .catch(() => undefined);
  } catch (error) {
    console.error("[INDICACAO] Falha ao registrar o pagamento do indicado:", error);
  }
}

export async function aoEstornoDoIndicado(contaId: string, motivo: string): Promise<void> {
  await prisma.indicacao
    .updateMany({
      where: { indicadoContaId: contaId, status: { in: ["PAGOU", "EM_CARENCIA"] } },
      data: { status: "INVALIDADA", motivoInvalidacao: motivo },
    })
    .catch((error) => console.error("[INDICACAO] Falha ao invalidar por estorno:", error));
}

export async function concederRecompensa(indicacao: Indicacao, agora: Date = new Date()): Promise<FormaAplicada> {
  const credito = await prisma.creditoDiasAssinatura.upsert({
    where: { indicacaoId: indicacao.id },
    update: {},
    create: {
      contaId: indicacao.indicadorContaId,
      dias: indicacao.diasRecompensa,
      origem: "INDICACAO",
      indicacaoId: indicacao.id,
      descricao: "Indicação que assinou",
    },
  });
  const forma = credito.forma === "PENDENTE" ? await aplicarCreditoNaHora(credito, agora) : (credito.forma as FormaAplicada);
  await prisma.indicacao.update({ where: { id: indicacao.id }, data: { status: "RECOMPENSADA", recompensadaEm: agora } });

  const indicador = await prisma.user.findUnique({ where: { id: indicacao.indicadorContaId }, select: { id: true, name: true, email: true } });
  if (indicador) {
    await prisma.notification
      .create({
        data: {
          userId: indicador.id,
          type: "INDICACAO",
          title: `Você ganhou ${indicacao.diasRecompensa} dias grátis`,
          body: DESCRICAO_FORMA[forma],
          link: "/indique",
        },
      })
      .catch(() => undefined);
    await dispararAutomacao({
      chave: "indicacao-recompensa",
      contaId: indicador.id,
      destinatario: { id: indicador.id, email: indicador.email },
      chaveIdempotencia: `indicacao-recompensa:${indicacao.id}`,
      variaveis: { dias: indicacao.diasRecompensa, forma: DESCRICAO_FORMA[forma] },
    });
  }
  return forma;
}

export interface ResultadoIndicacoes {
  avaliadas: number;
  recompensadas: number;
  invalidadas: number;
  aguardandoMl: number;
}

export async function processarIndicacoes(agora: Date = new Date()): Promise<ResultadoIndicacoes> {
  const { indicacao: regras } = await obterConfiguracaoComercial();
  const vencidas = { status: "EM_CARENCIA" as const, carenciaAte: { lte: agora } };
  const [prontas, aguardandoMl] = await Promise.all([
    prisma.indicacao.findMany({
      where: { ...vencidas, ...(regras.exigeMlConectado ? { ativadoEm: { not: null } } : {}) },
      orderBy: { carenciaAte: "asc" },
      take: 200,
    }),
    regras.exigeMlConectado ? prisma.indicacao.count({ where: { ...vencidas, ativadoEm: null } }) : Promise.resolve(0),
  ]);
  const resultado: ResultadoIndicacoes = { avaliadas: prontas.length, recompensadas: 0, invalidadas: 0, aguardandoMl };

  for (const indicacao of prontas) {
    const motivo = await motivoDeFraude(indicacao, { limiteRecompensasPorAno: regras.limiteRecompensasPorAno, agora });
    if (motivo) {
      await prisma.indicacao.update({ where: { id: indicacao.id }, data: { status: "INVALIDADA", motivoInvalidacao: motivo } });
      resultado.invalidadas++;
      continue;
    }
    await concederRecompensa(indicacao, agora);
    resultado.recompensadas++;
  }
  return resultado;
}

export async function aplicarPendentesDoTeste(contaId: string, agora: Date = new Date()): Promise<number> {
  const pendentes = await prisma.creditoDiasAssinatura.findMany({ where: { contaId, forma: "PENDENTE" } });
  let aplicados = 0;
  for (const credito of pendentes) {
    if ((await aplicarCreditoNaHora(credito, agora)) !== "PENDENTE") aplicados++;
  }
  return aplicados;
}
