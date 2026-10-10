import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";
const IV_LENGTH = 12;

function getKey(): Buffer | null {
  const base64Key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!base64Key) return null;

  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY deve decodificar para exatamente 32 bytes (AES-256)"
    );
  }
  return key;
}

/**
 * Criptografa um token para gravação em repouso. Sem TOKEN_ENCRYPTION_KEY
 * configurada, devolve o texto puro (ambiente de desenvolvimento sem a
 * chave definida) — nunca falha a escrita por falta de criptografia.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    PREFIX +
    Buffer.concat([iv, authTag, ciphertext]).toString("base64")
  );
}

/**
 * Descriptografa um token gravado por encryptToken. Valores sem o prefixo
 * `enc:v1:` são tratados como texto puro legado (período de transição) e
 * devolvidos como estão.
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }

  const key = getKey();
  if (!key) {
    throw new Error(
      "Token está criptografado mas TOKEN_ENCRYPTION_KEY não está configurada"
    );
  }

  const payload = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = payload.subarray(IV_LENGTH + 16);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function isTokenEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export type EstadoChaveCriptografia = "ok" | "ausente" | "invalida";

export function verificarChaveCriptografia(): EstadoChaveCriptografia {
  try {
    return getKey() ? "ok" : "ausente";
  } catch {
    return "invalida";
  }
}
