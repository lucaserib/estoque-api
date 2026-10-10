import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;

function gerarChaveValida(): string {
  return crypto.randomBytes(32).toString("base64");
}

describe("tokenCrypto", () => {
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
    }
  });

  describe("com TOKEN_ENCRYPTION_KEY configurada", () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = gerarChaveValida();
    });

    it("criptografa e descriptografa de volta para o valor original", async () => {
      const { encryptToken, decryptToken } = await import("@/lib/tokenCrypto");
      const original = "meu-access-token-secreto-123";

      const criptografado = encryptToken(original);
      expect(criptografado).not.toBe(original);
      expect(criptografado.startsWith("enc:v1:")).toBe(true);

      expect(decryptToken(criptografado)).toBe(original);
    });

    it("gera ciphertexts diferentes para o mesmo valor (IV aleatório)", async () => {
      const { encryptToken } = await import("@/lib/tokenCrypto");
      const a = encryptToken("mesmo-valor");
      const b = encryptToken("mesmo-valor");
      expect(a).not.toBe(b);
    });

    it("trata valor sem prefixo enc:v1: como texto puro legado", async () => {
      const { decryptToken } = await import("@/lib/tokenCrypto");
      expect(decryptToken("token-antigo-em-texto-puro")).toBe(
        "token-antigo-em-texto-puro"
      );
    });

    it("lança erro ao tentar descriptografar com a chave errada", async () => {
      const { encryptToken, decryptToken } = await import("@/lib/tokenCrypto");
      const criptografado = encryptToken("valor");

      process.env.TOKEN_ENCRYPTION_KEY = gerarChaveValida();
      expect(() => decryptToken(criptografado)).toThrow();
    });

    it("isTokenEncrypted identifica corretamente valores criptografados e legados", async () => {
      const { encryptToken, isTokenEncrypted } = await import(
        "@/lib/tokenCrypto"
      );
      expect(isTokenEncrypted(encryptToken("x"))).toBe(true);
      expect(isTokenEncrypted("texto-puro")).toBe(false);
    });

    it("rejeita chave com tamanho diferente de 32 bytes", async () => {
      process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("chave-curta").toString(
        "base64"
      );
      const { encryptToken } = await import("@/lib/tokenCrypto");
      expect(() => encryptToken("valor")).toThrow();
    });
  });

  describe("sem TOKEN_ENCRYPTION_KEY configurada", () => {
    beforeEach(() => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    });

    it("encryptToken devolve o texto puro sem falhar", async () => {
      const { encryptToken } = await import("@/lib/tokenCrypto");
      expect(encryptToken("valor-qualquer")).toBe("valor-qualquer");
    });

    it("decryptToken devolve texto legado sem exigir chave", async () => {
      const { decryptToken } = await import("@/lib/tokenCrypto");
      expect(decryptToken("valor-sem-prefixo")).toBe("valor-sem-prefixo");
    });

    it("decryptToken lança erro ao encontrar um valor já criptografado", async () => {
      const { decryptToken } = await import("@/lib/tokenCrypto");
      expect(() => decryptToken("enc:v1:qualquercoisa")).toThrow();
    });
  });
});
