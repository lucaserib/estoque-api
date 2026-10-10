import { Prisma } from "@prisma/client";
import { encryptToken, decryptToken } from "@/lib/tokenCrypto";

const TOKEN_FIELDS = ["accessToken", "refreshToken"] as const;

export function encryptTokenFields<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data };
  for (const field of TOKEN_FIELDS) {
    const value = next[field];
    if (typeof value === "string") {
      (next as Record<string, unknown>)[field] = encryptToken(value);
    }
  }
  return next;
}

export function decryptTokenFields<T>(result: T): T {
  if (!result || typeof result !== "object") return result;

  if (Array.isArray(result)) {
    return result.map((item) => decryptTokenFields(item)) as unknown as T;
  }

  const record = result as Record<string, unknown>;
  for (const field of TOKEN_FIELDS) {
    const value = record[field];
    if (typeof value === "string") {
      record[field] = decryptToken(value);
    }
  }
  return result;
}

export function encryptWriteArgs(
  operation: string,
  args: Record<string, unknown>
) {
  const next = { ...args };

  if (operation === "upsert") {
    if (next.create) next.create = encryptTokenFields(next.create as Record<string, unknown>);
    if (next.update) next.update = encryptTokenFields(next.update as Record<string, unknown>);
    return next;
  }

  if (next.data) {
    next.data = Array.isArray(next.data)
      ? next.data.map((item) => encryptTokenFields(item))
      : encryptTokenFields(next.data as Record<string, unknown>);
  }

  return next;
}

/**
 * Criptografa accessToken/refreshToken em repouso para BlingAccount e
 * MercadoLivreAccount (AES-256-GCM, src/lib/tokenCrypto.ts). Cobre toda
 * chamada direta a `prisma.blingAccount.*` / `prisma.mercadoLivreAccount.*`
 * em qualquer arquivo — não é preciso tocar cada rota/serviço que lê ou
 * grava esses campos.
 *
 * Limitação conhecida: extensions do Prisma só interceptam o modelo
 * consultado diretamente. Um `include: { blingAccount: true }` ou
 * `{ mercadoLivreAccount: true }` a partir de OUTRO modelo não passa por
 * aqui — os tokens viriam criptografados nesse caminho. Hoje nenhum ponto
 * do código lê o token por esse caminho (confirmado por grep), mas se um
 * novo `include` desses for adicionado e precisar do token em texto puro,
 * troque por uma consulta direta a `blingAccount`/`mercadoLivreAccount`.
 */
const WRITE_OPERATIONS = new Set([
  "create",
  "update",
  "upsert",
  "createMany",
  "updateMany",
]);

export const accountTokenEncryptionExtension = Prisma.defineExtension({
  name: "account-token-encryption",
  query: {
    blingAccount: {
      async $allOperations({ operation, args, query }) {
        const encryptedArgs = WRITE_OPERATIONS.has(operation)
          ? encryptWriteArgs(operation, args as Record<string, unknown>)
          : args;
        const result = await query(encryptedArgs as never);
        return decryptTokenFields(result);
      },
    },
    mercadoLivreAccount: {
      async $allOperations({ operation, args, query }) {
        const encryptedArgs = WRITE_OPERATIONS.has(operation)
          ? encryptWriteArgs(operation, args as Record<string, unknown>)
          : args;
        const result = await query(encryptedArgs as never);
        return decryptTokenFields(result);
      },
    },
  },
});
