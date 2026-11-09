import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  configuracaoComercial: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  CONFIGURACAO_PADRAO,
  ConfiguracaoInvalidaError,
  invalidarConfiguracaoComercial,
  obterConfiguracaoComercial,
  precoDoPlano,
  salvarConfiguracaoComercial,
  validarConfiguracaoComercial,
} from "../configuracao";

function linha(versao: number, parcial: Record<string, unknown> = {}) {
  return {
    id: `v${versao}`,
    versao,
    vigenteDesde: new Date(),
    criadaPor: "admin@skubo.com",
    observacao: null,
    createdAt: new Date(),
    ...CONFIGURACAO_PADRAO,
    ...parcial,
  };
}

describe("validação da configuração comercial", () => {
  it("aceita a configuração padrão", () => {
    expect(validarConfiguracaoComercial(CONFIGURACAO_PADRAO)).toMatchObject({ precoMensalCentavos: 3790 });
  });

  it("recusa preço zero, primeiro mês acima do mensal, anual acima de 12 mensais e pacotes repetidos", () => {
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ precoMensalCentavos: 0 }, "precoMensalCentavos"],
      [{ precoPrimeiroMesCentavos: 5000 }, "precoPrimeiroMesCentavos"],
      [{ precoAnualCentavos: 3790 * 12 + 1 }, "precoAnualCentavos"],
      [{ iaPacotes: [CONFIGURACAO_PADRAO.iaPacotes[0], CONFIGURACAO_PADRAO.iaPacotes[0]] }, "iaPacotes"],
    ];
    for (const [alteracao, campo] of casos) {
      const erro = (() => {
        try {
          validarConfiguracaoComercial({ ...CONFIGURACAO_PADRAO, ...alteracao });
        } catch (e) {
          return e;
        }
      })();
      expect(erro).toBeInstanceOf(ConfiguracaoInvalidaError);
      expect((erro as ConfiguracaoInvalidaError).problemas.map((p) => p.campo)).toContain(campo);
    }
  });

  it("primeiro mês nulo significa sem promoção", () => {
    const sem = { ...CONFIGURACAO_PADRAO, precoPrimeiroMesCentavos: null };
    expect(precoDoPlano(sem, "MONTHLY")).toEqual({ primeiraCobrancaCentavos: 3790, recorrenteCentavos: 3790 });
    expect(precoDoPlano(CONFIGURACAO_PADRAO, "MONTHLY")).toEqual({ primeiraCobrancaCentavos: 1970, recorrenteCentavos: 3790 });
    expect(precoDoPlano(CONFIGURACAO_PADRAO, "ANNUAL").primeiraCobrancaCentavos).toBe(38970);
  });
});

describe("versões e cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidarConfiguracaoComercial();
  });

  it("lê a última versão e guarda em cache por 60 s", async () => {
    prismaMock.configuracaoComercial.findFirst.mockResolvedValue(linha(4, { precoMensalCentavos: 4990 }));
    const primeira = await obterConfiguracaoComercial();
    const segunda = await obterConfiguracaoComercial();
    expect(primeira).toMatchObject({ versao: 4, precoMensalCentavos: 4990 });
    expect(segunda).toBe(primeira);
    expect(prismaMock.configuracaoComercial.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.configuracaoComercial.findFirst).toHaveBeenCalledWith({ orderBy: { versao: "desc" } });
  });

  it("sem nenhuma versão no banco usa o padrão", async () => {
    prismaMock.configuracaoComercial.findFirst.mockResolvedValue(null);
    expect(await obterConfiguracaoComercial()).toMatchObject({ versao: 0, diasTeste: 7 });
  });

  it("salvar cria a próxima versão (nunca edita a anterior) e limpa o cache", async () => {
    const tx = {
      configuracaoComercial: {
        findFirst: vi.fn(async () => ({ versao: 4 })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => linha(data.versao as number, data)),
      },
    };
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    prismaMock.configuracaoComercial.findFirst.mockResolvedValue(linha(4));
    await obterConfiguracaoComercial();

    const salva = await salvarConfiguracaoComercial({ ...CONFIGURACAO_PADRAO, precoMensalCentavos: 4290 }, "admin@skubo.com", "Reajuste");

    expect(tx.configuracaoComercial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ versao: 5, criadaPor: "admin@skubo.com", observacao: "Reajuste", precoMensalCentavos: 4290 }),
    });
    expect(salva.versao).toBe(5);
    prismaMock.configuracaoComercial.findFirst.mockResolvedValue(linha(5, { precoMensalCentavos: 4290 }));
    expect((await obterConfiguracaoComercial()).versao).toBe(5);
  });

  it("não salva configuração inválida", async () => {
    await expect(salvarConfiguracaoComercial({ ...CONFIGURACAO_PADRAO, diasTeste: 0 }, "admin@skubo.com")).rejects.toBeInstanceOf(
      ConfiguracaoInvalidaError
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
