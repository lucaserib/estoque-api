import crypto from "crypto";
import { obterSegredoAuth } from "@/lib/authSecret";

const VALIDADE_SEGUNDOS = 15 * 60;

export type MotivoStateInvalido = "formato" | "assinatura" | "expirado" | "usuario_diferente";

export type VerificacaoState =
  | { ok: true; userId: string }
  | { ok: false; motivo: MotivoStateInvalido };

function assinar(conteudo: string): string {
  const segredo = obterSegredoAuth();
  if (!segredo) throw new Error("NEXTAUTH_SECRET/AUTH_SECRET não configurado");
  return crypto.createHmac("sha256", segredo).update(conteudo).digest("base64url");
}

export function criarStateBling(userId: string, agora: number = Date.now()): string {
  const nonce = crypto.randomBytes(12).toString("base64url");
  const expira = Math.floor(agora / 1000) + VALIDADE_SEGUNDOS;
  const idCodificado = Buffer.from(userId, "utf8").toString("base64url");
  const conteudo = `${nonce}.${idCodificado}.${expira}`;
  return `${conteudo}.${assinar(conteudo)}`;
}

export function verificarStateBling(
  state: string | null | undefined,
  userIdSessao: string | null,
  agora: number = Date.now()
): VerificacaoState {
  if (!state) return { ok: false, motivo: "formato" };
  const partes = state.split(".");
  if (partes.length !== 4) return { ok: false, motivo: "formato" };

  const [nonce, idCodificado, expiraTexto, assinatura] = partes;
  const conteudo = `${nonce}.${idCodificado}.${expiraTexto}`;
  const esperada = Buffer.from(assinar(conteudo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) {
    return { ok: false, motivo: "assinatura" };
  }

  const expira = Number(expiraTexto);
  if (!Number.isFinite(expira) || expira * 1000 < agora) return { ok: false, motivo: "expirado" };

  const userId = Buffer.from(idCodificado, "base64url").toString("utf8");
  if (!userId) return { ok: false, motivo: "formato" };
  if (userIdSessao && userIdSessao !== userId) return { ok: false, motivo: "usuario_diferente" };

  return { ok: true, userId };
}
