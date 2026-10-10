import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diagnosticarConfiguracaoBling, origemDaRequisicao } from "@/lib/blingConfig";

const ORIGEM = "https://estoque-api-4iqj.vercel.app";
const ENV_ORIGINAL = { ...process.env };

describe("diagnosticarConfiguracaoBling", () => {
  beforeEach(() => {
    process.env.BLING_CLIENT_ID = "id";
    process.env.BLING_CLIENT_SECRET = "segredo";
    process.env.NEXTAUTH_SECRET = "nextauth";
    process.env.NEXTAUTH_URL = ORIGEM;
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    delete process.env.BLING_REDIRECT_URI;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it("aprova uma configuração completa e devolve o callback esperado", () => {
    const resultado = diagnosticarConfiguracaoBling(ORIGEM);
    expect(resultado.ok).toBe(true);
    expect(resultado.callbackEsperado).toBe(`${ORIGEM}/api/bling/auth/callback`);
  });

  it("bloqueia quando o client secret está ausente", () => {
    delete process.env.BLING_CLIENT_SECRET;
    const resultado = diagnosticarConfiguracaoBling(ORIGEM);
    expect(resultado.ok).toBe(false);
    expect(resultado.verificacoes.find((v) => v.item === "BLING_CLIENT_SECRET")?.ok).toBe(false);
  });

  it("bloqueia quando a TOKEN_ENCRYPTION_KEY não tem 32 bytes", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "curta";
    const resultado = diagnosticarConfiguracaoBling(ORIGEM);
    expect(resultado.ok).toBe(false);
    expect(resultado.verificacoes.find((v) => v.item === "TOKEN_ENCRYPTION_KEY")?.bloqueante).toBe(true);
  });

  it("permite chave ausente, apenas sinalizando", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(diagnosticarConfiguracaoBling(ORIGEM).ok).toBe(true);
  });

  it("avisa sem bloquear quando NEXTAUTH_URL é de outro domínio", () => {
    process.env.NEXTAUTH_URL = "https://outro-dominio.vercel.app";
    const resultado = diagnosticarConfiguracaoBling(ORIGEM);
    expect(resultado.ok).toBe(true);
    expect(resultado.verificacoes.find((v) => v.item === "NEXTAUTH_URL")?.ok).toBe(false);
  });

  it("sinaliza BLING_REDIRECT_URI divergente", () => {
    process.env.BLING_REDIRECT_URI = "http://localhost:3000/api/bling/auth/callback";
    const resultado = diagnosticarConfiguracaoBling(ORIGEM);
    expect(resultado.verificacoes.find((v) => v.item === "BLING_REDIRECT_URI")?.ok).toBe(false);
  });

  it("bloqueia origem http fora de localhost", () => {
    expect(diagnosticarConfiguracaoBling("http://meu-app.com").ok).toBe(false);
    expect(diagnosticarConfiguracaoBling("http://localhost:3000").ok).toBe(true);
  });
});

describe("origemDaRequisicao", () => {
  it("usa os cabeçalhos encaminhados pela Vercel", () => {
    const headers = new Headers({ "x-forwarded-proto": "https", "x-forwarded-host": "estoque-api-4iqj.vercel.app" });
    expect(origemDaRequisicao("http://localhost/api", headers)).toBe(ORIGEM);
  });

  it("cai para a URL quando não há cabeçalhos", () => {
    expect(origemDaRequisicao("http://localhost:3000/api/x", new Headers())).toBe("http://localhost:3000");
  });
});
