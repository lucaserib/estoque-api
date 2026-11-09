import crypto from "node:crypto";
import type { TipoMotivoCancelamento } from "@prisma/client";
import { obterSegredoAuth } from "@/lib/authSecret";
import { urlDoApp } from "@/modules/email/config";

export const MOTIVOS_CANCELAMENTO: Array<{ motivo: TipoMotivoCancelamento; rotulo: string }> = [
  { motivo: "PRECO", rotulo: "Ficou caro para mim" },
  { motivo: "FALTOU_RECURSO", rotulo: "Faltou algum recurso" },
  { motivo: "DIFICIL", rotulo: "Achei difícil de usar" },
  { motivo: "PAROU_DE_VENDER", rotulo: "Parei de vender" },
  { motivo: "OUTRA_FERRAMENTA", rotulo: "Fui para outra ferramenta" },
  { motivo: "OUTRO", rotulo: "Outro motivo" },
];

function segredo(): string {
  return process.env.DESCADASTRO_SEGREDO?.trim() || `pesquisa:${obterSegredoAuth() ?? "dev"}`;
}

export function tokenPesquisa(contaId: string): string {
  const conteudo = Buffer.from(`cancelamento:${contaId}`).toString("base64url");
  const assinatura = crypto.createHmac("sha256", segredo()).update(conteudo).digest("base64url").slice(0, 32);
  return `${conteudo}.${assinatura}`;
}

export function contaDoTokenPesquisa(token: string | null | undefined): string | null {
  if (!token) return null;
  const [conteudo, assinatura] = token.split(".");
  if (!conteudo || !assinatura) return null;
  const esperada = Buffer.from(crypto.createHmac("sha256", segredo()).update(conteudo).digest("base64url").slice(0, 32));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) return null;
  const [tipo, contaId] = Buffer.from(conteudo, "base64url").toString("utf8").split(":");
  return tipo === "cancelamento" && contaId ? contaId : null;
}

export function linksPesquisaCancelamento(contaId: string): Array<{ rotulo: string; url: string }> {
  const token = encodeURIComponent(tokenPesquisa(contaId));
  return MOTIVOS_CANCELAMENTO.map(({ motivo, rotulo }) => ({
    rotulo,
    url: `${urlDoApp()}/pesquisa/cancelamento?t=${token}&m=${motivo}`,
  }));
}
