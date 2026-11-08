import { beforeEach, describe, expect, it } from "vitest";
import { criarStateBling, verificarStateBling } from "../blingOAuthState";

describe("state do OAuth do Bling", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "segredo-de-teste";
  });

  it("aceita o state criado para o mesmo usuário, com ou sem sessão no retorno", () => {
    const state = criarStateBling("user-123");
    expect(verificarStateBling(state, "user-123")).toEqual({ ok: true, userId: "user-123" });
    expect(verificarStateBling(state, null)).toEqual({ ok: true, userId: "user-123" });
  });

  it("recusa quando a sessão do retorno é de outro usuário", () => {
    const state = criarStateBling("user-123");
    expect(verificarStateBling(state, "outro")).toEqual({ ok: false, motivo: "usuario_diferente" });
  });

  it("recusa state adulterado", () => {
    const state = criarStateBling("user-123");
    const partes = state.split(".");
    partes[1] = Buffer.from("invasor").toString("base64url");
    expect(verificarStateBling(partes.join("."), null)).toEqual({ ok: false, motivo: "assinatura" });
  });

  it("recusa state expirado", () => {
    const criadoEm = Date.now() - 60 * 60 * 1000;
    const state = criarStateBling("user-123", criadoEm);
    expect(verificarStateBling(state, null)).toEqual({ ok: false, motivo: "expirado" });
  });

  it("recusa formato inválido", () => {
    expect(verificarStateBling("abc", null)).toEqual({ ok: false, motivo: "formato" });
    expect(verificarStateBling(null, null)).toEqual({ ok: false, motivo: "formato" });
  });
});
