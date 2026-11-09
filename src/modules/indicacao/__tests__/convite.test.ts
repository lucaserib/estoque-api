import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  perfilCliente: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  indicacao: { findUnique: vi.fn(async () => null) },
  subscription: { findUnique: vi.fn(async () => ({ status: "TRIALING" })) },
  pagamentoPlataforma: { count: vi.fn(async () => 0) },
}));
const cadastro = vi.hoisted(() => ({ registrarIndicacaoNoCadastro: vi.fn(async () => ({ id: "ind-1" })) }));
const regras = vi.hoisted(() => ({ ativo: true }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../cadastro", () => cadastro);
vi.mock("@/modules/comercial/configuracao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/comercial/configuracao")>();
  return {
    ...original,
    obterConfiguracaoComercial: vi.fn(async () => ({
      ...original.CONFIGURACAO_PADRAO,
      indicacao: { ...original.CONFIGURACAO_PADRAO.indicacao, ativo: regras.ativo },
    })),
  };
});

import { CodigoIndicacaoError, consultarConvite, informarCodigoDepois, motivoParaNaoInformarCodigo } from "../convite";

const AGORA = new Date("2026-11-20T12:00:00Z");
const dono = { id: "conta-1", contaId: "conta-1" };

beforeEach(() => {
  vi.clearAllMocks();
  regras.ativo = true;
  prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-11-15T12:00:00Z") });
  prismaMock.perfilCliente.findUnique.mockImplementation(async ({ where }: { where: { codigoIndicacao?: string; contaId?: string } }) =>
    where.codigoIndicacao === "SKU-AB12"
      ? { nomeLoja: "Loja da Bia", conta: { name: "Bia Lima", bloqueadoEm: null } }
      : where.contaId
        ? { codigoIndicacao: "SKU-PROPRIO" }
        : null
  );
});

describe("convite de indicação", () => {
  it("mostra quem convidou pelo nome da loja e o bônus", async () => {
    expect(await consultarConvite("sku-ab12")).toEqual({
      valido: true,
      codigo: "SKU-AB12",
      convidadoPor: "Loja da Bia",
      bonusPerguntasIa: 5,
      diasTesteExtra: 0,
    });
  });

  it("código inexistente, malformado ou com programa pausado não vale", async () => {
    expect((await consultarConvite("SKU-ZZZZ")).valido).toBe(false);
    expect((await consultarConvite("<script>")).valido).toBe(false);
    regras.ativo = false;
    expect((await consultarConvite("SKU-AB12")).valido).toBe(false);
  });

  it("informar o código depois do cadastro registra a indicação", async () => {
    expect(await informarCodigoDepois(dono, "SKU-AB12", AGORA)).toEqual({ convidadoPor: "Loja da Bia", bonusPerguntasIa: 5 });
    expect(cadastro.registrarIndicacaoNoCadastro).toHaveBeenCalledWith("conta-1", "SKU-AB12", AGORA);
  });

  it("recusa membro da equipe, conta antiga, quem já pagou, quem já foi indicado e o próprio código", async () => {
    expect(await motivoParaNaoInformarCodigo({ id: "membro", contaId: "conta-1" }, AGORA)).toMatch(/criou a conta/);
    prismaMock.user.findUnique.mockResolvedValueOnce({ createdAt: new Date("2026-10-01T12:00:00Z") });
    expect(await motivoParaNaoInformarCodigo(dono, AGORA)).toMatch(/primeiros 14 dias/);
    prismaMock.pagamentoPlataforma.count.mockResolvedValueOnce(1);
    expect(await motivoParaNaoInformarCodigo(dono, AGORA)).toMatch(/antes do primeiro pagamento/);
    prismaMock.indicacao.findUnique.mockResolvedValueOnce({ id: "x" } as never);
    expect(await motivoParaNaoInformarCodigo(dono, AGORA)).toMatch(/já entrou/);
    prismaMock.perfilCliente.findUnique.mockImplementation(async ({ where }: { where: { codigoIndicacao?: string; contaId?: string } }) =>
      where.codigoIndicacao ? { nomeLoja: null, conta: { name: "Eu", bloqueadoEm: null } } : { codigoIndicacao: "SKU-AB12" }
    );
    await expect(informarCodigoDepois(dono, "SKU-AB12", AGORA)).rejects.toBeInstanceOf(CodigoIndicacaoError);
    expect(cadastro.registrarIndicacaoNoCadastro).not.toHaveBeenCalled();
  });
});
