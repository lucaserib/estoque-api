import { z } from "zod";
import { Prisma, type Campanha } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularSituacao, cobrancaObrigatoria } from "@/modules/conta/situacao";
import { lerPreferencias, podeReceberCategoria } from "@/modules/clientes/consentimento";
import { motivoDaCategoria, renderizarAutomacao, variaveisDaConta } from "./automacoes";
import { enviarEmail } from "./enviar";

const DIA_MS = 24 * 60 * 60 * 1000;
const LOTE_ENFILEIRAMENTO = 500;

export const segmentoSchema = z.object({
  situacoes: z.array(z.enum(["TESTE", "ATIVA", "INADIMPLENTE", "VENCIDA", "CANCELADA", "BLOQUEADA"])).optional(),
  planos: z.array(z.enum(["MONTHLY", "ANNUAL", "SEM"])).optional(),
  diasDesdeCadastroMin: z.number().int().min(0).optional(),
  diasDesdeCadastroMax: z.number().int().min(0).optional(),
  mlConectado: z.boolean().optional(),
  blingConectado: z.boolean().optional(),
  comprouCreditos: z.boolean().optional(),
  saldoIaMin: z.number().int().min(0).optional(),
  saldoIaMax: z.number().int().min(0).optional(),
  utmSource: z.string().max(120).optional(),
  comoConheceu: z.array(z.string().max(30)).optional(),
  faixas: z.array(z.string().max(30)).optional(),
  canais: z.array(z.string().max(30)).optional(),
  apenasComConsentimento: z.boolean().optional(),
  incluirTesteInterno: z.boolean().optional(),
});

export type Segmento = z.infer<typeof segmentoSchema>;

export interface Destinatario {
  contaId: string;
  userId: string;
  email: string;
}

export async function resolverPublico(
  segmentoBruto: unknown,
  categoria: "MARKETING" | "CICLO_DE_VIDA",
  agora: Date = new Date()
): Promise<Destinatario[]> {
  const segmento = segmentoSchema.parse(segmentoBruto ?? {});
  const [donos, saldos, compradores, suprimidos] = await Promise.all([
    prisma.user.findMany({
      where: { contaId: null },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        bloqueadoEm: true,
        preferencias: true,
        subscription: true,
        perfilCliente: { select: { utmSource: true, comoConheceu: true, faixaPedidosMes: true, canais: true, testeInterno: true } },
        MercadoLivreAccount: { where: { isActive: true }, select: { id: true } },
        BlingAccount: { where: { isActive: true }, select: { id: true } },
      },
    }),
    prisma.loteCreditoIa.groupBy({
      by: ["contaId"],
      where: { validoAte: { gt: agora }, quantidadeRestante: { gt: 0 } },
      _sum: { quantidadeRestante: true },
    }),
    prisma.compraCreditoIa.findMany({ where: { status: "APROVADA" }, select: { contaId: true }, distinct: ["contaId"] }),
    prisma.supressaoEmail.findMany({ select: { email: true, motivo: true } }),
  ]);

  const saldoPorConta = new Map(saldos.map((s) => [s.contaId, s._sum.quantidadeRestante ?? 0]));
  const compraram = new Set(compradores.map((c) => c.contaId));
  const bloqueados = new Set(suprimidos.filter((s) => categoria === "MARKETING" || s.motivo !== "MANUAL").map((s) => s.email));
  const cobrar = cobrancaObrigatoria();

  return donos
    .filter((dono) => {
      if (dono.bloqueadoEm || bloqueados.has(dono.email.toLowerCase())) return false;
      const perfil = dono.perfilCliente;
      if (perfil?.testeInterno && !segmento.incluirTesteInterno) return false;
      const preferencias = lerPreferencias(dono.preferencias);
      if (!podeReceberCategoria(preferencias, categoria)) return false;
      if (segmento.apenasComConsentimento && !preferencias.marketingEmail) return false;

      if (segmento.situacoes?.length) {
        const situacao = calcularSituacao(dono.id, dono.subscription, dono, agora, { cobrancaObrigatoria: cobrar });
        if (!segmento.situacoes.includes(situacao.status)) return false;
      }
      if (segmento.planos?.length) {
        const plano = dono.subscription?.status === "ACTIVE" ? dono.subscription.plan ?? "SEM" : "SEM";
        if (!segmento.planos.includes(plano)) return false;
      }
      const dias = (agora.getTime() - dono.createdAt.getTime()) / DIA_MS;
      if (segmento.diasDesdeCadastroMin !== undefined && dias < segmento.diasDesdeCadastroMin) return false;
      if (segmento.diasDesdeCadastroMax !== undefined && dias > segmento.diasDesdeCadastroMax) return false;
      if (segmento.mlConectado !== undefined && dono.MercadoLivreAccount.length > 0 !== segmento.mlConectado) return false;
      if (segmento.blingConectado !== undefined && dono.BlingAccount.length > 0 !== segmento.blingConectado) return false;
      if (segmento.comprouCreditos !== undefined && compraram.has(dono.id) !== segmento.comprouCreditos) return false;
      const saldo = saldoPorConta.get(dono.id) ?? 0;
      if (segmento.saldoIaMin !== undefined && saldo < segmento.saldoIaMin) return false;
      if (segmento.saldoIaMax !== undefined && saldo > segmento.saldoIaMax) return false;
      if (segmento.utmSource && perfil?.utmSource !== segmento.utmSource) return false;
      if (segmento.comoConheceu?.length && !segmento.comoConheceu.includes(perfil?.comoConheceu ?? "")) return false;
      if (segmento.faixas?.length && !segmento.faixas.includes(perfil?.faixaPedidosMes ?? "")) return false;
      if (segmento.canais?.length && !segmento.canais.some((c) => perfil?.canais.includes(c))) return false;
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((dono) => ({ contaId: dono.id, userId: dono.id, email: dono.email }));
}

async function conteudoDaCampanha(campanha: Campanha, destinatario: Pick<Destinatario, "contaId" | "userId">) {
  const variaveis = await variaveisDaConta(destinatario.contaId, destinatario.userId);
  const conteudo = renderizarAutomacao(
    {
      assunto: campanha.assunto,
      preCabecalho: campanha.preCabecalho,
      corpoMarkdown: campanha.corpoMarkdown,
      rotuloBotao: campanha.rotuloBotao,
      urlBotao: campanha.urlBotao,
      cupomCodigo: null,
    },
    variaveis
  );
  return { ...conteudo, motivo: motivoDaCategoria(campanha.categoria) };
}

export async function enviarTesteDeCampanha(campanha: Campanha, admin: { id: string; email: string }) {
  const conteudo = await conteudoDaCampanha(campanha, { contaId: admin.id, userId: admin.id });
  return enviarEmail({
    para: admin.email,
    modelo: "automacao",
    categoria: "TRANSACIONAL",
    dados: { ...conteudo, assunto: `[Teste] ${conteudo.assunto}` },
    chaveIdempotencia: `teste-campanha:${campanha.id}:${Date.now()}`,
    userId: admin.id,
    urgente: true,
  });
}

export async function enfileirarProximoLote(campanha: Campanha, agora: Date = new Date()): Promise<{ enfileirados: number; concluida: boolean }> {
  const categoria = campanha.categoria === "CICLO_DE_VIDA" ? "CICLO_DE_VIDA" : "MARKETING";
  const publico = await resolverPublico(campanha.segmento, categoria, agora);
  const lote = publico.slice(campanha.enfileirados, campanha.enfileirados + LOTE_ENFILEIRAMENTO);

  let enfileirados = 0;
  for (const destinatario of lote) {
    const conteudo = await conteudoDaCampanha(campanha, destinatario);
    const resultado = await enviarEmail({
      para: destinatario.email,
      modelo: campanha.categoria === "CICLO_DE_VIDA" ? "automacao" : "campanha",
      categoria,
      dados: conteudo,
      chaveIdempotencia: `campanha:${campanha.id}:${destinatario.userId}`,
      userId: destinatario.userId,
      contaId: destinatario.contaId,
      campanhaId: campanha.id,
      urgente: false,
    });
    if (resultado.novo) enfileirados++;
  }

  const concluida = campanha.enfileirados + lote.length >= publico.length;
  await prisma.campanha.update({
    where: { id: campanha.id },
    data: {
      enfileirados: { increment: lote.length },
      publicoTotal: publico.length,
      ...(concluida ? { status: "ENVIADA", concluidaEm: agora } : {}),
    },
  });
  return { enfileirados, concluida };
}

export async function processarCampanhas(agora: Date = new Date(), prazoMs = 20_000): Promise<number> {
  const prazo = Date.now() + prazoMs;
  await prisma.campanha.updateMany({
    where: { status: "AGENDADA", agendadaPara: { lte: agora } },
    data: { status: "ENVIANDO", iniciadaEm: agora },
  });
  const emEnvio = await prisma.campanha.findMany({ where: { status: "ENVIANDO" }, orderBy: { iniciadaEm: "asc" } });
  let lotes = 0;
  for (const campanha of emEnvio) {
    if (Date.now() > prazo) break;
    await enfileirarProximoLote(campanha, agora);
    lotes++;
  }
  return lotes;
}

export async function metricasDaCampanha(campanha: Pick<Campanha, "id" | "iniciadaEm" | "createdAt">) {
  const [porStatus, destinatarios] = await Promise.all([
    prisma.emailEnviado.groupBy({ by: ["status"], where: { campanhaId: campanha.id }, _count: { _all: true } }),
    prisma.emailEnviado.findMany({ where: { campanhaId: campanha.id, userId: { not: null } }, select: { userId: true } }),
  ]);
  const descadastros = destinatarios.length
    ? await prisma.consentimentoRegistro.count({
        where: {
          userId: { in: destinatarios.map((d) => d.userId!) },
          origem: "descadastro",
          concedido: false,
          createdAt: { gte: campanha.iniciadaEm ?? campanha.createdAt },
        },
      })
    : 0;
  const contagem = Object.fromEntries(porStatus.map((s) => [s.status, s._count._all])) as Record<string, number>;
  const soma = (...status: string[]) => status.reduce((t, s) => t + (contagem[s] ?? 0), 0);
  return {
    enviados: soma("ENVIADO", "ENTREGUE", "ABERTO", "CLICADO", "DEVOLVIDO", "RECLAMACAO"),
    entregues: soma("ENTREGUE", "ABERTO", "CLICADO"),
    abertos: soma("ABERTO", "CLICADO"),
    cliques: soma("CLICADO"),
    devolucoes: soma("DEVOLVIDO"),
    reclamacoes: soma("RECLAMACAO"),
    suprimidos: soma("SUPRIMIDO"),
    naFila: soma("ENFILEIRADO"),
    falhas: soma("FALHOU"),
    descadastros,
  };
}

export function dadosCampanhaParaSalvar(entrada: {
  nome: string;
  assunto: string;
  preCabecalho: string;
  corpoMarkdown: string;
  rotuloBotao?: string | null;
  urlBotao?: string | null;
  segmento: unknown;
  categoria: "MARKETING" | "CICLO_DE_VIDA";
  agendadaPara?: Date | null;
}) {
  return {
    nome: entrada.nome.trim(),
    assunto: entrada.assunto.trim(),
    preCabecalho: entrada.preCabecalho.trim(),
    corpoMarkdown: entrada.corpoMarkdown,
    rotuloBotao: entrada.rotuloBotao?.trim() || null,
    urlBotao: entrada.urlBotao?.trim() || null,
    segmento: segmentoSchema.parse(entrada.segmento ?? {}) as Prisma.InputJsonValue,
    categoria: entrada.categoria,
    agendadaPara: entrada.agendadaPara ?? null,
  };
}
