import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;

describe("accountTokenEncryption", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
    }
  });

  describe("encryptWriteArgs", () => {
    it("criptografa accessToken e refreshToken em args.data (create/update)", async () => {
      const { encryptWriteArgs } = await import("@/lib/accountTokenEncryption");
      const { isTokenEncrypted } = await import("@/lib/tokenCrypto");

      const result = encryptWriteArgs("create", {
        data: { accessToken: "token-a", refreshToken: "token-b", isActive: true },
      });

      const data = result.data as Record<string, unknown>;
      expect(isTokenEncrypted(data.accessToken as string)).toBe(true);
      expect(isTokenEncrypted(data.refreshToken as string)).toBe(true);
      expect(data.isActive).toBe(true);
    });

    it("criptografa create e update separadamente em upsert", async () => {
      const { encryptWriteArgs } = await import("@/lib/accountTokenEncryption");
      const { isTokenEncrypted } = await import("@/lib/tokenCrypto");

      const result = encryptWriteArgs("upsert", {
        create: { accessToken: "a1", refreshToken: "r1" },
        update: { accessToken: "a2", refreshToken: "r2" },
      });

      const create = result.create as Record<string, unknown>;
      const update = result.update as Record<string, unknown>;
      expect(isTokenEncrypted(create.accessToken as string)).toBe(true);
      expect(isTokenEncrypted(update.accessToken as string)).toBe(true);
      expect(create.accessToken).not.toBe(update.accessToken);
    });

    it("não falha quando data não inclui tokens (ex.: update só de isActive)", async () => {
      const { encryptWriteArgs } = await import("@/lib/accountTokenEncryption");

      const result = encryptWriteArgs("update", {
        data: { isActive: false },
      });

      expect(result.data).toEqual({ isActive: false });
    });

    it("deixa argumentos de leitura (findFirst) intocados", async () => {
      const { encryptWriteArgs } = await import("@/lib/accountTokenEncryption");
      const args = { where: { id: "abc" } };

      // encryptWriteArgs só é chamado para operações de escrita no extension;
      // aqui garantimos que, mesmo chamada, não introduz campos novos.
      const result = encryptWriteArgs("findFirst", args);
      expect(result).toEqual(args);
    });
  });

  describe("decryptTokenFields", () => {
    it("descriptografa um objeto único com accessToken/refreshToken", async () => {
      const { encryptToken } = await import("@/lib/tokenCrypto");
      const { decryptTokenFields } = await import("@/lib/accountTokenEncryption");

      const registro = {
        id: "acc-1",
        accessToken: encryptToken("token-original"),
        refreshToken: encryptToken("refresh-original"),
        isActive: true,
      };

      const resultado = decryptTokenFields(registro);
      expect(resultado.accessToken).toBe("token-original");
      expect(resultado.refreshToken).toBe("refresh-original");
      expect(resultado.isActive).toBe(true);
    });

    it("descriptografa cada item de um array (findMany)", async () => {
      const { encryptToken } = await import("@/lib/tokenCrypto");
      const { decryptTokenFields } = await import("@/lib/accountTokenEncryption");

      const registros = [
        { id: "1", accessToken: encryptToken("a") },
        { id: "2", accessToken: encryptToken("b") },
      ];

      const resultado = decryptTokenFields(registros);
      expect(resultado[0].accessToken).toBe("a");
      expect(resultado[1].accessToken).toBe("b");
    });

    it("devolve null como está (findFirst sem resultado)", async () => {
      const { decryptTokenFields } = await import("@/lib/accountTokenEncryption");
      expect(decryptTokenFields(null)).toBeNull();
    });

    it("devolve números/contagens como estão (count/aggregate)", async () => {
      const { decryptTokenFields } = await import("@/lib/accountTokenEncryption");
      expect(decryptTokenFields(5)).toBe(5);
    });
  });

  describe("round-trip via encryptWriteArgs + decryptTokenFields", () => {
    it("um create seguido de leitura recupera os tokens originais", async () => {
      const { encryptWriteArgs, decryptTokenFields } = await import(
        "@/lib/accountTokenEncryption"
      );

      const argsEscrita = encryptWriteArgs("create", {
        data: { accessToken: "access-real", refreshToken: "refresh-real" },
      });

      // Simula o que seria persistido e depois lido de volta do banco.
      const registroComoSeViesseDoBanco = {
        id: "acc-1",
        ...(argsEscrita.data as { accessToken: string; refreshToken: string }),
      };

      const lido = decryptTokenFields(registroComoSeViesseDoBanco);
      expect(lido.accessToken).toBe("access-real");
      expect(lido.refreshToken).toBe("refresh-real");
    });
  });
});
