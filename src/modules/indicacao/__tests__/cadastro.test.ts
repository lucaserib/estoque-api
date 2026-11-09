import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  indicacao: { findUnique: vi.fn(async () => null), create: vi.fn() },
  perfilCliente: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn(async () => null) },
  user: { findUnique: vi.fn(async () => ({ id: "indicador", name: "Bia Lima", email: "bia@loja.com" })) },
  notification: { create: vi.fn(async () => ({})) },
  mercadoLivreAccount: { count: vi.fn(async () => 0) },
}));
const creditos = vi.hoisted(() => ({ concederLote: vi.fn(async () => ({ lote: {}, novo: true })) }));
const automacoes = vi.hoisted(() => ({ dispararAutomacao: vi.fn(async () => null) }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/ia/creditos", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/modules/ia/creditos")>()), ...creditos }));
vi.mock("@/modules/email/automacoes", () => automacoes);
vi.mock("@/modules/clientes/eventos", () => ({ registrarEvento: vi.fn() }));
vi.mock("@/modules/conta/situacao", () => ({ invalidarSituacaoConta: vi.fn() }));
vi.mock("@/modules/comercial/configuracao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/comercial/configuracao")>();
  return { ...original, obterConfiguracaoComercial: vi.fn(async () => original.CONFIGURACAO_PADRAO) };
});

import { registrarIndicacaoNoCadastro } from "../cadastro";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.indicacao.create.mockImplementation(async ({ data }) => ({ id: "ind-1", ...data }));
});

describe("indicação no cadastro", () => {
  it("loja que já tem o Mercado Livre conectado entra como ativada", async () => {
    prismaMock.perfilCliente.findUnique.mockResolvedValue({ contaId: "indicador" });
    prismaMock.mercadoLivreAccount.count.mockResolvedValueOnce(1);
    const agora = new Date("2026-11-10T12:00:00Z");
    const indicacao = await registrarIndicacaoNoCadastro("novo", "SKU-AB12", agora);
    expect(indicacao).toMatchObject({ status: "ATIVADO", ativadoEm: agora });
  });

  it("cria a indicação, dá 5 perguntas ao indicado e avisa quem indicou", async () => {
    prismaMock.perfilCliente.findUnique.mockResolvedValue({ contaId: "indicador" });
    const indicacao = await registrarIndicacaoNoCadastro("novo", "sku-ab12");
    expect(prismaMock.perfilCliente.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { codigoIndicacao: "SKU-AB12" } }));
    expect(indicacao).toMatchObject({ indicadorContaId: "indicador", indicadoContaId: "novo", diasRecompensa: 7 });
    expect(creditos.concederLote).toHaveBeenCalledWith(
      expect.objectContaining({ contaId: "novo", origem: "INDICACAO", quantidade: 5, chaveIdempotencia: "bonus-indicado:ind-1" }),
      expect.any(Date)
    );
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(expect.objectContaining({ chave: "indicacao-entrou", variaveis: expect.objectContaining({ dias: 7 }) }));
  });

  it("o próprio código fica registrado como inválido, sem bônus", async () => {
    prismaMock.perfilCliente.findUnique.mockResolvedValue({ contaId: "novo" });
    const indicacao = await registrarIndicacaoNoCadastro("novo", "SKU-AB12");
    expect(indicacao).toMatchObject({ status: "INVALIDADA" });
    expect(creditos.concederLote).not.toHaveBeenCalled();
  });

  it("código inexistente é ignorado", async () => {
    prismaMock.perfilCliente.findUnique.mockResolvedValue(null);
    expect(await registrarIndicacaoNoCadastro("novo", "SKU-ZZZZ")).toBeNull();
    expect(prismaMock.indicacao.create).not.toHaveBeenCalled();
  });
});
