import { z } from "zod";
import type { ConfiguracaoComercial as LinhaConfiguracao } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const pacoteIaSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,40}$/, "O id do pacote usa só letras minúsculas, números e hífen."),
  nome: z.string().trim().min(1, "Dê um nome ao pacote.").max(60),
  perguntas: z.number().int().min(1, "O pacote precisa ter pelo menos 1 pergunta.").max(10000),
  precoCentavos: z.number().int().min(100, "O preço mínimo de um pacote é R$ 1,00."),
  ativo: z.boolean(),
  destaque: z.boolean(),
});

export const pesoPorRecursoSchema = z.object({
  CHAT: z.number().int().min(0).max(10),
  ANALISE_CONTROLE: z.number().int().min(0).max(10),
  EXPLICACAO: z.number().int().min(0).max(10),
  RESUMO_SEMANAL: z.number().int().min(0).max(10),
});

export const regrasIndicacaoSchema = z.object({
  ativo: z.boolean(),
  diasRecompensa: z.number().int().min(1).max(90),
  carenciaDias: z.number().int().min(0).max(60),
  limiteRecompensasPorAno: z.number().int().min(0).max(365),
  exigeMlConectado: z.boolean(),
  bonusIndicado: z.object({
    perguntasIa: z.number().int().min(0).max(100),
    diasTesteExtra: z.number().int().min(0).max(30),
  }),
});

export const textosOfertaSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  subtitulo: z.string().trim().max(240),
  beneficios: z.array(z.string().trim().min(1).max(140)).max(8),
  seloAnual: z.string().trim().max(40),
  chamadaMensal: z.string().trim().max(60),
  chamadaTeste: z.string().trim().max(60),
});

export const configuracaoComercialSchema = z
  .object({
    diasTeste: z.number().int().min(1, "O teste precisa ter pelo menos 1 dia.").max(60),
    precoMensalCentavos: z.number().int().positive("O preço mensal precisa ser maior que zero."),
    precoPrimeiroMesCentavos: z.number().int().positive("O preço do primeiro mês precisa ser maior que zero.").nullable(),
    precoAnualCentavos: z.number().int().positive("O preço anual precisa ser maior que zero."),
    iaPerguntasTeste: z.number().int().min(0).max(100),
    iaValidadeDiasTeste: z.number().int().min(1).max(365),
    iaValidadeDiasCompra: z.number().int().min(1).max(1095),
    iaPacotes: z.array(pacoteIaSchema).min(1, "Cadastre pelo menos um pacote de IA.").max(10),
    iaPesoPorRecurso: pesoPorRecursoSchema,
    iaExplicacoesGratisPorDia: z.number().int().min(0).max(500),
    iaResumoSemanalSoAssinantes: z.boolean(),
    indicacao: regrasIndicacaoSchema,
    limiteUsuariosPorConta: z.number().int().min(1).max(500).nullable(),
    textosOferta: textosOfertaSchema,
  })
  .superRefine((dados, ctx) => {
    if (dados.precoPrimeiroMesCentavos !== null && dados.precoPrimeiroMesCentavos > dados.precoMensalCentavos) {
      ctx.addIssue({
        code: "custom",
        path: ["precoPrimeiroMesCentavos"],
        message: "O primeiro mês não pode custar mais que o mensal.",
      });
    }
    if (dados.precoAnualCentavos > dados.precoMensalCentavos * 12) {
      ctx.addIssue({
        code: "custom",
        path: ["precoAnualCentavos"],
        message: "O anual não pode custar mais que 12 mensalidades.",
      });
    }
    const ids = dados.iaPacotes.map((p) => p.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["iaPacotes"], message: "Cada pacote precisa de um id diferente." });
    }
  });

export type DadosConfiguracaoComercial = z.infer<typeof configuracaoComercialSchema>;
export type PacoteIa = z.infer<typeof pacoteIaSchema>;
export type RegrasIndicacao = z.infer<typeof regrasIndicacaoSchema>;
export type TextosOferta = z.infer<typeof textosOfertaSchema>;

export interface ConfiguracaoComercial extends DadosConfiguracaoComercial {
  versao: number;
  vigenteDesde: Date;
  criadaPor: string;
  observacao: string | null;
}

export const CONFIGURACAO_PADRAO: DadosConfiguracaoComercial = {
  diasTeste: 7,
  precoMensalCentavos: 3790,
  precoPrimeiroMesCentavos: 1970,
  precoAnualCentavos: 38970,
  iaPerguntasTeste: 5,
  iaValidadeDiasTeste: 14,
  iaValidadeDiasCompra: 365,
  iaPacotes: [{ id: "pacote-25", nome: "25 perguntas", perguntas: 25, precoCentavos: 2970, ativo: true, destaque: true }],
  iaPesoPorRecurso: { CHAT: 1, ANALISE_CONTROLE: 1, EXPLICACAO: 0, RESUMO_SEMANAL: 0 },
  iaExplicacoesGratisPorDia: 20,
  iaResumoSemanalSoAssinantes: true,
  indicacao: {
    ativo: true,
    diasRecompensa: 7,
    carenciaDias: 7,
    limiteRecompensasPorAno: 52,
    exigeMlConectado: true,
    bonusIndicado: { perguntasIa: 5, diasTesteExtra: 0 },
  },
  limiteUsuariosPorConta: null,
  textosOferta: {
    titulo: "Escolha o plano da sua loja",
    subtitulo: "7 dias grátis, sem cartão. Depois, escolha como quer continuar.",
    beneficios: [
      "Estoque local e Full sincronizados com o Mercado Livre e o Bling",
      "Reposição com o que comprar e quando, sobre a venda real",
      "Lucro de verdade por venda, produto e logística",
      "Equipe com papéis e permissões",
      "Suporte por WhatsApp",
    ],
    seloAnual: "2 meses grátis",
    chamadaMensal: "Primeiro mês com desconto",
    chamadaTeste: "Comece grátis por 7 dias",
  },
};

const CACHE_MS = 60_000;
const memoria = globalThis as typeof globalThis & { __configuracaoComercial?: { valor: ConfiguracaoComercial; expiraEm: number } | null };

function lerJson<T>(schema: z.ZodType<T>, valor: unknown, padrao: T): T {
  const lido = schema.safeParse(valor);
  return lido.success ? lido.data : padrao;
}

export function deLinha(linha: LinhaConfiguracao): ConfiguracaoComercial {
  return {
    versao: linha.versao,
    vigenteDesde: linha.vigenteDesde,
    criadaPor: linha.criadaPor,
    observacao: linha.observacao,
    diasTeste: linha.diasTeste,
    precoMensalCentavos: linha.precoMensalCentavos,
    precoPrimeiroMesCentavos: linha.precoPrimeiroMesCentavos,
    precoAnualCentavos: linha.precoAnualCentavos,
    iaPerguntasTeste: linha.iaPerguntasTeste,
    iaValidadeDiasTeste: linha.iaValidadeDiasTeste,
    iaValidadeDiasCompra: linha.iaValidadeDiasCompra,
    iaPacotes: lerJson(z.array(pacoteIaSchema), linha.iaPacotes, CONFIGURACAO_PADRAO.iaPacotes),
    iaPesoPorRecurso: lerJson(pesoPorRecursoSchema, linha.iaPesoPorRecurso, CONFIGURACAO_PADRAO.iaPesoPorRecurso),
    iaExplicacoesGratisPorDia: linha.iaExplicacoesGratisPorDia,
    iaResumoSemanalSoAssinantes: linha.iaResumoSemanalSoAssinantes,
    indicacao: lerJson(regrasIndicacaoSchema, linha.indicacao, CONFIGURACAO_PADRAO.indicacao),
    limiteUsuariosPorConta: linha.limiteUsuariosPorConta,
    textosOferta: lerJson(textosOfertaSchema, linha.textosOferta, CONFIGURACAO_PADRAO.textosOferta),
  };
}

function padraoComoConfiguracao(): ConfiguracaoComercial {
  return { ...CONFIGURACAO_PADRAO, versao: 0, vigenteDesde: new Date(0), criadaPor: "padrão", observacao: null };
}

export async function obterConfiguracaoComercial(): Promise<ConfiguracaoComercial> {
  const agora = Date.now();
  const cache = memoria.__configuracaoComercial;
  if (cache && cache.expiraEm > agora) return cache.valor;
  const linha = await prisma.configuracaoComercial.findFirst({ orderBy: { versao: "desc" } });
  const valor = linha ? deLinha(linha) : padraoComoConfiguracao();
  memoria.__configuracaoComercial = { valor, expiraEm: agora + CACHE_MS };
  return valor;
}

export function invalidarConfiguracaoComercial(): void {
  memoria.__configuracaoComercial = null;
}

export class ConfiguracaoInvalidaError extends Error {
  readonly code = "CONFIGURACAO_INVALIDA";

  constructor(readonly problemas: Array<{ campo: string; mensagem: string }>) {
    super(problemas[0]?.mensagem ?? "Configuração inválida");
    this.name = "ConfiguracaoInvalidaError";
  }
}

export function validarConfiguracaoComercial(dados: unknown): DadosConfiguracaoComercial {
  const lido = configuracaoComercialSchema.safeParse(dados);
  if (!lido.success) {
    throw new ConfiguracaoInvalidaError(
      lido.error.issues.map((issue) => ({ campo: issue.path.join("."), mensagem: issue.message }))
    );
  }
  return lido.data;
}

export async function salvarConfiguracaoComercial(
  dados: unknown,
  adminEmail: string,
  observacao: string | null = null
): Promise<ConfiguracaoComercial> {
  const validos = validarConfiguracaoComercial(dados);
  const criada = await prisma.$transaction(async (tx) => {
    const ultima = await tx.configuracaoComercial.findFirst({ orderBy: { versao: "desc" }, select: { versao: true } });
    return tx.configuracaoComercial.create({
      data: {
        ...validos,
        versao: (ultima?.versao ?? 0) + 1,
        criadaPor: adminEmail,
        observacao: observacao?.trim() || null,
        vigenteDesde: new Date(),
      },
    });
  });
  invalidarConfiguracaoComercial();
  return deLinha(criada);
}

export async function listarVersoesConfiguracao(limite = 30): Promise<ConfiguracaoComercial[]> {
  const linhas = await prisma.configuracaoComercial.findMany({ orderBy: { versao: "desc" }, take: limite });
  return linhas.map(deLinha);
}

export function pacotesAtivos(configuracao: Pick<ConfiguracaoComercial, "iaPacotes">): PacoteIa[] {
  return configuracao.iaPacotes.filter((pacote) => pacote.ativo);
}

export function precoDoPlano(
  configuracao: Pick<ConfiguracaoComercial, "precoMensalCentavos" | "precoPrimeiroMesCentavos" | "precoAnualCentavos">,
  plano: "MONTHLY" | "ANNUAL"
): { primeiraCobrancaCentavos: number; recorrenteCentavos: number } {
  if (plano === "ANNUAL") {
    return { primeiraCobrancaCentavos: configuracao.precoAnualCentavos, recorrenteCentavos: configuracao.precoAnualCentavos };
  }
  return {
    primeiraCobrancaCentavos: configuracao.precoPrimeiroMesCentavos ?? configuracao.precoMensalCentavos,
    recorrenteCentavos: configuracao.precoMensalCentavos,
  };
}
