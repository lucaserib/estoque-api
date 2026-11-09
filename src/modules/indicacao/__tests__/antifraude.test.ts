import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  perfilCliente: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  subscription: { findUnique: vi.fn() },
  pagamentoPlataforma: { findMany: vi.fn() },
  mercadoLivreAccount: { findMany: vi.fn() },
  blingAccount: { findMany: vi.fn() },
  eventoProduto: { findMany: vi.fn() },
  indicacao: { count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { motivoDeFraude } from "../antifraude";
import { emailCanonico, mascararNome } from "../comum";

const indicacao = { id: "ind-1", indicadorContaId: "indicador", indicadoContaId: "indicado" };
const regras = { limiteRecompensasPorAno: 52 };

function porConta<T>(mapa: Record<string, T>, padrao: T) {
  return async ({ where }: { where: Record<string, unknown> }) => {
    const chave = (where.contaId ?? where.userId ?? (where.OR as Array<{ id?: string }> | undefined)?.[0]?.id) as string;
    return mapa[chave] ?? padrao;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.perfilCliente.findUnique.mockImplementation(porConta({ indicador: { whatsapp: "+5511999990000" }, indicado: { whatsapp: "+5511888880000", testeInterno: false } }, null));
  prismaMock.user.findMany.mockImplementation(porConta({ indicador: [{ email: "ana@loja.com" }], indicado: [{ email: "bia@outra.com" }] }, []));
  prismaMock.subscription.findUnique.mockResolvedValue(null);
  prismaMock.pagamentoPlataforma.findMany.mockResolvedValue([]);
  prismaMock.mercadoLivreAccount.findMany.mockImplementation(porConta({ indicador: [{ mlUserId: "111" }], indicado: [{ mlUserId: "222" }] }, []));
  prismaMock.blingAccount.findMany.mockResolvedValue([]);
  prismaMock.eventoProduto.findMany.mockResolvedValue([]);
  prismaMock.indicacao.count.mockResolvedValue(0);
});

describe("antifraude da indicação", () => {
  it("indicação limpa passa", async () => {
    expect(await motivoDeFraude(indicacao, regras)).toBeNull();
  });

  it("mesma conta", async () => {
    expect(await motivoDeFraude({ ...indicacao, indicadoContaId: "indicador" }, regras)).toMatch(/a si mesma/);
  });

  it("mesmo e-mail, inclusive com ponto e +etiqueta do Gmail", async () => {
    prismaMock.user.findMany.mockImplementation(porConta({ indicador: [{ email: "ana.souza@gmail.com" }], indicado: [{ email: "anasouza+loja2@gmail.com" }] }, []));
    expect(await motivoDeFraude(indicacao, regras)).toMatch(/mesmo e-mail/);
  });

  it("mesmo WhatsApp", async () => {
    prismaMock.perfilCliente.findUnique.mockImplementation(porConta({ indicador: { whatsapp: "+5511999990000" }, indicado: { whatsapp: "+5511999990000", testeInterno: false } }, null));
    expect(await motivoDeFraude(indicacao, regras)).toMatch(/WhatsApp/);
  });

  it("pagamento saiu do e-mail de quem indicou", async () => {
    prismaMock.pagamentoPlataforma.findMany.mockImplementation(porConta({ indicado: [{ emailPagador: "ana@loja.com" }] }, []));
    expect(await motivoDeFraude(indicacao, regras)).toMatch(/pagamento/);
  });

  it("mesma conta do Mercado Livre, inclusive pelo histórico de conexões", async () => {
    prismaMock.mercadoLivreAccount.findMany.mockImplementation(porConta({ indicador: [], indicado: [{ mlUserId: "333" }] }, []));
    prismaMock.eventoProduto.findMany.mockImplementation(async ({ where }: { where: { contaId: string; nome: string } }) =>
      where.contaId === "indicador" && where.nome === "ML_CONECTADO" ? [{ propriedades: { mlUserId: "333" } }] : []
    );
    expect(await motivoDeFraude(indicacao, regras)).toMatch(/Mercado Livre/);
  });

  it("mesma empresa do Bling", async () => {
    prismaMock.blingAccount.findMany.mockImplementation(porConta({ indicador: [{ blingCompanyId: "emp-1" }], indicado: [{ blingCompanyId: "emp-1" }] }, []));
    expect(await motivoDeFraude(indicacao, regras)).toMatch(/Bling/);
  });

  it("conta indicada de teste interno", async () => {
    prismaMock.perfilCliente.findUnique.mockImplementation(porConta({ indicador: { whatsapp: null }, indicado: { whatsapp: null, testeInterno: true } }, null));
    expect(await motivoDeFraude(indicacao, regras)).toMatch(/teste interno/);
  });

  it("limite de recompensas no ano", async () => {
    prismaMock.indicacao.count.mockResolvedValue(52);
    expect(await motivoDeFraude(indicacao, regras)).toMatch(/Limite de 52/);
  });
});

describe("utilitários", () => {
  it("e-mail canônico só junta pontos e etiqueta no Gmail", () => {
    expect(emailCanonico("A.Na+x@Gmail.com")).toBe("ana@gmail.com");
    expect(emailCanonico("a.na+x@empresa.com")).toBe("a.na@empresa.com");
  });

  it("mascara o nome mostrado ao indicador", () => {
    expect(mascararNome("Loja Store", null)).toBe("Lo** St***");
    expect(mascararNome(null, "bia@x.com")).toBe("bi*");
  });
});
