import crypto from "node:crypto";
import type { FinalidadeToken } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const HORA_MS = 60 * 60 * 1000;

export const VALIDADE_TOKEN_MS: Record<FinalidadeToken, number> = {
  REDEFINIR_SENHA: HORA_MS,
  CONFIRMAR_EMAIL: 72 * HORA_MS,
};

export class TokenInvalidoError extends Error {
  readonly code = "TOKEN_INVALIDO";

  constructor(readonly motivo: "NAO_ENCONTRADO" | "EXPIRADO" | "USADO") {
    super(
      motivo === "EXPIRADO"
        ? "Este link expirou. Peça um novo."
        : motivo === "USADO"
          ? "Este link já foi usado. Peça um novo se precisar."
          : "Link inválido. Peça um novo."
    );
    this.name = "TokenInvalidoError";
  }
}

export function hashDoToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function gerarTokenUsuario(
  userId: string,
  finalidade: FinalidadeToken,
  opcoes: { ip?: string | null; agora?: Date } = {}
): Promise<{ token: string; expiraEm: Date }> {
  const agora = opcoes.agora ?? new Date();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiraEm = new Date(agora.getTime() + VALIDADE_TOKEN_MS[finalidade]);

  await prisma.$transaction([
    prisma.tokenSenha.updateMany({
      where: { userId, finalidade, usadoEm: null },
      data: { usadoEm: agora },
    }),
    prisma.tokenSenha.create({
      data: { userId, finalidade, tokenHash: hashDoToken(token), expiraEm, ip: opcoes.ip ?? null },
    }),
  ]);

  return { token, expiraEm };
}

export async function consumirTokenUsuario(
  token: string,
  finalidade: FinalidadeToken,
  agora: Date = new Date()
): Promise<string> {
  const registro = await prisma.tokenSenha.findUnique({ where: { tokenHash: hashDoToken(token) } });
  if (!registro || registro.finalidade !== finalidade) throw new TokenInvalidoError("NAO_ENCONTRADO");
  if (registro.usadoEm) throw new TokenInvalidoError("USADO");
  if (registro.expiraEm.getTime() <= agora.getTime()) throw new TokenInvalidoError("EXPIRADO");

  const { count } = await prisma.tokenSenha.updateMany({
    where: { id: registro.id, usadoEm: null },
    data: { usadoEm: agora },
  });
  if (count === 0) throw new TokenInvalidoError("USADO");
  return registro.userId;
}

export async function limparTokensVencidos(agora: Date = new Date()): Promise<number> {
  const { count } = await prisma.tokenSenha.deleteMany({
    where: { expiraEm: { lt: new Date(agora.getTime() - 7 * 24 * HORA_MS) } },
  });
  return count;
}
