import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const decodeMock = vi.fn();
vi.mock("next-auth/jwt", () => ({
  decode: (...args: unknown[]) => decodeMock(...args),
}));

const { extrairContaId } = await import("../instrumentation");

const SEGREDO_ORIGINAL = process.env.NEXTAUTH_SECRET;

beforeEach(() => {
  decodeMock.mockReset();
  process.env.NEXTAUTH_SECRET = "segredo-de-teste";
});

afterEach(() => {
  process.env.NEXTAUTH_SECRET = SEGREDO_ORIGINAL;
});

describe("extrairContaId", () => {
  it("devolve null sem NEXTAUTH_SECRET configurado", async () => {
    delete process.env.NEXTAUTH_SECRET;
    const resultado = await extrairContaId({ cookie: "next-auth.session-token=abc" });
    expect(resultado).toBeNull();
    expect(decodeMock).not.toHaveBeenCalled();
  });

  it("devolve null sem cookie de sessão", async () => {
    const resultado = await extrairContaId({});
    expect(resultado).toBeNull();
  });

  it("decodifica o cookie não-seguro e devolve o contaId do token", async () => {
    decodeMock.mockResolvedValue({ id: "user-1", contaId: "conta-1" });
    const resultado = await extrairContaId({ cookie: "outro=x; next-auth.session-token=token-aqui; mais=y" });
    expect(resultado).toBe("conta-1");
    expect(decodeMock).toHaveBeenCalledWith({ token: "token-aqui", secret: "segredo-de-teste" });
  });

  it("prefere o cookie __Secure- quando presente", async () => {
    decodeMock.mockResolvedValue({ id: "user-1", contaId: "conta-segura" });
    const resultado = await extrairContaId({
      cookie: "__Secure-next-auth.session-token=token-seguro; next-auth.session-token=token-antigo",
    });
    expect(resultado).toBe("conta-segura");
    expect(decodeMock).toHaveBeenCalledWith({ token: "token-seguro", secret: "segredo-de-teste" });
  });

  it("cai para o id do usuário quando o token não tem contaId", async () => {
    decodeMock.mockResolvedValue({ id: "user-1" });
    const resultado = await extrairContaId({ cookie: "next-auth.session-token=token-aqui" });
    expect(resultado).toBe("user-1");
  });

  it("devolve null quando o token é inválido", async () => {
    decodeMock.mockRejectedValue(new Error("assinatura inválida"));
    const resultado = await extrairContaId({ cookie: "next-auth.session-token=token-adulterado" });
    expect(resultado).toBeNull();
  });

  it("aceita cookie em formato de array", async () => {
    decodeMock.mockResolvedValue({ id: "user-1", contaId: "conta-array" });
    const resultado = await extrairContaId({ cookie: ["a=b", "next-auth.session-token=token-aqui"] });
    expect(resultado).toBe("conta-array");
  });
});
