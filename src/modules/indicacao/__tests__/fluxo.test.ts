import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  indicacao: {
    findMany: vi.fn(),
    update: vi.fn(async () => ({})),
    findUnique: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 1 })),
    count: vi.fn(async () => 0),
  },
  creditoDiasAssinatura: { upsert: vi.fn(async () => ({ id: "cred-1", contaId: "indicador", dias: 7, forma: "PENDENTE" })) },
  user: { findUnique: vi.fn(async () => ({ id: "indicador", name: "Ana", email: "ana@loja.com" })) },
  notification: { create: vi.fn(async () => ({})) },
}));
const antifraude = vi.hoisted(() => ({ motivoDeFraude: vi.fn(async () => null as string | null) }));
const recompensa = vi.hoisted(() => ({ aplicarCreditoNaHora: vi.fn(async () => "EXTENSAO_TESTE") }));
const automacoes = vi.hoisted(() => ({ dispararAutomacao: vi.fn(async () => null) }));
const regras = vi.hoisted(() => ({ exigeMlConectado: true }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../antifraude", () => antifraude);
vi.mock("../recompensa", () => recompensa);
vi.mock("@/modules/email/automacoes", () => automacoes);
vi.mock("@/modules/comercial/configuracao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/comercial/configuracao")>();
  return {
    ...original,
    obterConfiguracaoComercial: vi.fn(async () => ({
      ...original.CONFIGURACAO_PADRAO,
      indicacao: { ...original.CONFIGURACAO_PADRAO.indicacao, exigeMlConectado: regras.exigeMlConectado },
    })),
  };
});

import { aoConectarMercadoLivre, aoEstornoDoIndicado, aoPagamentoAprovadoDoIndicado, processarIndicacoes } from "../fluxo";

const AGORA = new Date("2026-11-20T12:00:00.000Z");
const pronta = {
  id: "ind-1",
  indicadorContaId: "indicador",
  indicadoContaId: "indicado",
  status: "EM_CARENCIA",
  diasRecompensa: 7,
  ativadoEm: new Date("2026-11-01"),
  carenciaAte: new Date("2026-11-19"),
};

beforeEach(() => {
  vi.clearAllMocks();
  regras.exigeMlConectado = true;
});

describe("fluxo da indicação", () => {
  it("primeiro pagamento do indicado começa a carência de 7 dias e avisa quem indicou", async () => {
    prismaMock.indicacao.findUnique.mockResolvedValue({
      id: "ind-1",
      status: "ATIVADO",
      indicadorContaId: "indicador",
      diasRecompensa: 7,
      ativadoEm: new Date("2026-11-10"),
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "indicado", name: "Bruno Lima", email: "b@l.com" });
    await aoPagamentoAprovadoDoIndicado("indicado", "pay-1", AGORA);
    expect(prismaMock.indicacao.update).toHaveBeenCalledWith({
      where: { id: "ind-1" },
      data: { status: "EM_CARENCIA", pagamentoId: "pay-1", pagouEm: AGORA, carenciaAte: new Date("2026-11-27T12:00:00.000Z") },
    });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "indicador",
        title: "Sua indicação assinou o Skubo",
        body: "Br*** Li** assinou. Seus 7 dias grátis saem a partir de 27/11.",
      }),
    });
  });

  it("conectar o ML depois de pagar também conta para a recompensa", async () => {
    await aoConectarMercadoLivre("indicado", AGORA);
    expect(prismaMock.indicacao.updateMany).toHaveBeenCalledWith({
      where: { indicadoContaId: "indicado", status: "CADASTRADO" },
      data: { status: "ATIVADO", ativadoEm: AGORA },
    });
    expect(prismaMock.indicacao.updateMany).toHaveBeenCalledWith({
      where: { indicadoContaId: "indicado", ativadoEm: null, status: { in: ["PAGOU", "EM_CARENCIA"] } },
      data: { ativadoEm: AGORA },
    });
  });

  it("estorno na carência invalida com motivo", async () => {
    await aoEstornoDoIndicado("indicado", "Pagamento estornado durante a carência.");
    expect(prismaMock.indicacao.updateMany).toHaveBeenCalledWith({
      where: { indicadoContaId: "indicado", status: { in: ["PAGOU", "EM_CARENCIA"] } },
      data: { status: "INVALIDADA", motivoInvalidacao: "Pagamento estornado durante a carência." },
    });
  });

  it("depois da carência sem fraude: concede os dias, marca RECOMPENSADA e avisa", async () => {
    prismaMock.indicacao.findMany.mockResolvedValue([pronta]);
    expect(await processarIndicacoes(AGORA)).toMatchObject({ recompensadas: 1, invalidadas: 0 });
    expect(prismaMock.creditoDiasAssinatura.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { indicacaoId: "ind-1" }, create: expect.objectContaining({ contaId: "indicador", dias: 7, origem: "INDICACAO" }) })
    );
    expect(prismaMock.indicacao.update).toHaveBeenCalledWith({ where: { id: "ind-1" }, data: { status: "RECOMPENSADA", recompensadaEm: AGORA } });
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(expect.objectContaining({ chave: "indicacao-recompensa", chaveIdempotencia: "indicacao-recompensa:ind-1" }));
  });

  it("fraude invalida com o motivo, nunca em silêncio", async () => {
    prismaMock.indicacao.findMany.mockResolvedValue([pronta]);
    antifraude.motivoDeFraude.mockResolvedValueOnce("Autoindicação: mesmo WhatsApp nas duas contas.");
    expect(await processarIndicacoes(AGORA)).toMatchObject({ invalidadas: 1, recompensadas: 0 });
    expect(prismaMock.indicacao.update).toHaveBeenCalledWith({
      where: { id: "ind-1" },
      data: { status: "INVALIDADA", motivoInvalidacao: "Autoindicação: mesmo WhatsApp nas duas contas." },
    });
  });

  it("sem Mercado Livre conectado, espera fora do lote quando a regra exige", async () => {
    prismaMock.indicacao.findMany.mockResolvedValue([]);
    prismaMock.indicacao.count.mockResolvedValueOnce(3);
    expect(await processarIndicacoes(AGORA)).toMatchObject({ aguardandoMl: 3, recompensadas: 0 });
    expect(prismaMock.indicacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "EM_CARENCIA", carenciaAte: { lte: AGORA }, ativadoEm: { not: null } } })
    );
    regras.exigeMlConectado = false;
    prismaMock.indicacao.findMany.mockResolvedValue([{ ...pronta, ativadoEm: null }]);
    expect(await processarIndicacoes(AGORA)).toMatchObject({ recompensadas: 1, aguardandoMl: 0 });
    expect(prismaMock.indicacao.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: "EM_CARENCIA", carenciaAte: { lte: AGORA } } })
    );
  });
});
