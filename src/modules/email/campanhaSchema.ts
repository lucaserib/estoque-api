import { z } from "zod";

export const campanhaSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome à campanha.").max(120),
  assunto: z.string().trim().min(1, "Escreva o assunto.").max(150),
  preCabecalho: z.string().trim().max(200).default(""),
  corpoMarkdown: z.string().trim().min(1, "Escreva o texto do e-mail.").max(10000),
  rotuloBotao: z.string().trim().max(60).nullish(),
  urlBotao: z.string().trim().max(300).nullish(),
  segmento: z.record(z.unknown()).default({}),
  categoria: z.enum(["MARKETING", "CICLO_DE_VIDA"]).default("MARKETING"),
});
