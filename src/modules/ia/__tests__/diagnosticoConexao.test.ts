import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { diagnosticarConexaoIa } = await import("../diagnosticoConexao");
const { IaIndisponivelError } = await import("../erros");

const ORIGINAL = { ...process.env };
beforeEach(() => {
  for (const chave of Object.keys(process.env)) if (chave.startsWith("IA_") || chave.startsWith("ANTHROPIC_")) delete process.env[chave];
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("diagnosticarConexaoIa", () => {
  it("sem chave não chama a API", async () => {
    const criarMensagem = vi.fn();
    const r = await diagnosticarConexaoIa({ criarMensagem, transmitirMensagem: vi.fn() } as never);
    expect(r).toMatchObject({ configurada: false, modelos: [] });
    expect(criarMensagem).not.toHaveBeenCalled();
  });

  it("testa o modelo principal e o rápido e mostra o erro técnico para o admin", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-usr-x";
    process.env.IA_DESLIGADA = "1";
    const criarMensagem = vi.fn(async ({ modelo }: { modelo: string }) => {
      if (modelo === "claude-haiku-5-5") {
        throw new IaIndisponivelError("instável", "FALHA_PROVEDOR", "REQUISICAO_INVALIDA", "400 This API key is not scoped to a workspace");
      }
      return { content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } };
    });
    const r = await diagnosticarConexaoIa({ criarMensagem, transmitirMensagem: vi.fn() } as never);
    expect(r).toMatchObject({ configurada: true, desligada: true, workspaceDefinido: false, precosConfigurados: false });
    expect(r.modelos).toEqual([
      expect.objectContaining({ modelo: "claude-sonnet-5-5", papel: "principal", ok: true, resposta: "ok" }),
      expect.objectContaining({
        modelo: "claude-haiku-5-5",
        papel: "rapido",
        ok: false,
        erro: "REQUISICAO_INVALIDA — 400 This API key is not scoped to a workspace",
      }),
    ]);
  });
});
