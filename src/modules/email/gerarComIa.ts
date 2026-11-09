import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { RecursoIa } from "@prisma/client";
import { lerJsonDaResposta, obterProvedorIa, type ProvedorIa } from "@/modules/ia/cliente";
import { ESFORCO, modeloPrincipal } from "@/modules/ia/config";
import { IaIndisponivelError } from "@/modules/ia/erros";
import { registrarUsoIa } from "@/modules/ia/uso";

const ESQUEMA_RASCUNHO: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["assuntos", "preCabecalho", "corpoMarkdown"],
  properties: {
    assuntos: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
    preCabecalho: { type: "string" },
    corpoMarkdown: { type: "string" },
  },
};

const rascunhoSchema = z.object({
  assuntos: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
  preCabecalho: z.string().trim().max(200),
  corpoMarkdown: z.string().trim().min(1).max(6000),
});

export type RascunhoEmail = z.infer<typeof rascunhoSchema>;

let vozEmCache: string | null = null;

export function vozDaMarca(): string {
  if (vozEmCache) return vozEmCache;
  try {
    vozEmCache = fs.readFileSync(path.join(process.cwd(), "docs", "marketing", "voz-da-marca.md"), "utf8");
  } catch {
    vozEmCache = "Escreva em português do Brasil, direto, curto, sem promessas de resultado, sem caixa alta e com uma ação por e-mail.";
  }
  return vozEmCache;
}

export async function gerarRascunhoEmail(
  entrada: { briefing: string; categoria: "MARKETING" | "CICLO_DE_VIDA" | "TRANSACIONAL" },
  admin: { id: string },
  provedor: ProvedorIa = obterProvedorIa()
): Promise<RascunhoEmail> {
  const modelo = modeloPrincipal();
  const inicio = Date.now();
  const sistema = `Você escreve e-mails do Skubo, um sistema de estoque, reposição e lucro para lojistas do Mercado Livre. Siga à risca o guia de voz abaixo. Devolva exatamente 5 opções de assunto, 1 pré-cabeçalho e 1 corpo em Markdown simples.\n\n${vozDaMarca()}`;
  try {
    const resposta = await provedor.criarMensagem({
      recurso: RecursoIa.MARKETING_ADMIN,
      modelo,
      sistemaFixo: sistema,
      mensagens: [
        {
          role: "user",
          content: `Tipo de e-mail: ${entrada.categoria === "MARKETING" ? "novidade/oferta (marketing)" : entrada.categoria === "CICLO_DE_VIDA" ? "ajuda para usar o produto (ciclo de vida)" : "aviso da conta (transacional)"}.\n\nBriefing do time:\n${entrada.briefing.slice(0, 2000)}`,
        },
      ],
      maxTokens: 3000,
      esforco: ESFORCO.analise,
      formato: ESQUEMA_RASCUNHO,
    });
    await registrarUsoIa({
      contaId: admin.id,
      autorId: admin.id,
      recurso: RecursoIa.MARKETING_ADMIN,
      modelo,
      uso: resposta.usage,
      duracaoMs: Date.now() - inicio,
      sucesso: true,
    });
    const lido = rascunhoSchema.safeParse(lerJsonDaResposta<unknown>(resposta));
    if (!lido.success) throw new IaIndisponivelError("A IA não devolveu um rascunho válido. Tente de novo.", "FALHA_PROVEDOR");
    return lido.data;
  } catch (error) {
    if (!(error instanceof IaIndisponivelError && error.message.includes("rascunho válido"))) {
      await registrarUsoIa({
        contaId: admin.id,
        autorId: admin.id,
        recurso: RecursoIa.MARKETING_ADMIN,
        modelo,
        uso: null,
        duracaoMs: Date.now() - inicio,
        sucesso: false,
        codigoErro: error instanceof IaIndisponivelError ? error.detalhe ?? error.codigo : "ERRO_INTERNO",
      });
    }
    throw error;
  }
}
