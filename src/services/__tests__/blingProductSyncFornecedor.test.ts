import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  fornecedor: { upsert: vi.fn(async () => ({ id: "forn-novo" })), findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/blingImageHost", () => ({ rehostTemporaryImage: vi.fn() }));

const real = await vi.importActual<typeof import("@/services/blingService")>("@/services/blingService");
const getProductSuppliers = vi.fn();
const getContact = vi.fn();
vi.mock("@/services/blingService", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/blingService")>();
  return {
    ...original,
    BlingService: Object.assign(Object.create(original.BlingService), { getProductSuppliers, getContact }),
  };
});

const { resolverFornecedorPrincipalBling } = await import("../blingProductSync");

beforeEach(() => vi.clearAllMocks());

describe("resolverFornecedorPrincipalBling", () => {
  it("com todas as permissões cria ou atualiza o fornecedor e devolve o custo do Bling", async () => {
    getProductSuppliers.mockResolvedValue([{ fornecedor: { id: 7 }, padrao: true, precoCompra: 12.5, codigo: "F7" }]);
    getContact.mockResolvedValue({ id: 7, nome: "Fornecedor Alfa", numeroDocumento: "00.000.000/0001-00" });
    const r = await resolverFornecedorPrincipalBling("conta-bling", 100, "user-1");
    expect(r).toEqual({ fornecedorId: "forn-novo", precoCusto: 12.5, codigo: "F7" });
  });

  it("sem a permissão de Contatos o produto não trava: mantém o custo e liga ao fornecedor já conhecido", async () => {
    getProductSuppliers.mockResolvedValue([{ fornecedor: { id: 8 }, padrao: true, precoCusto: 9.9, codigo: "F7" }]);
    getContact.mockRejectedValue(new real.BlingEscopoError("/contatos/8"));
    prismaMock.fornecedor.findUnique.mockResolvedValueOnce({ id: "forn-existente" }).mockResolvedValueOnce(null);

    expect(await resolverFornecedorPrincipalBling("conta-bling", 101, "user-1")).toEqual({
      fornecedorId: "forn-existente",
      precoCusto: 9.9,
      codigo: "F7",
      permissaoFaltando: "Contatos (leitura)",
    });
    expect(await resolverFornecedorPrincipalBling("conta-bling", 102, "user-1")).toMatchObject({
      fornecedorId: null,
      precoCusto: 9.9,
      permissaoFaltando: "Contatos (leitura)",
    });
    expect(prismaMock.fornecedor.upsert).not.toHaveBeenCalled();
  });

  it("sem a permissão de fornecedores (403 puro) segue sem fornecedor", async () => {
    getProductSuppliers.mockRejectedValue(new real.BlingApiError(403, "/produtos/fornecedores?idProduto=103", "Forbidden"));
    expect(await resolverFornecedorPrincipalBling("conta-bling", 103, "user-1")).toEqual({
      fornecedorId: null,
      precoCusto: null,
      codigo: undefined,
      permissaoFaltando: "Produtos — fornecedores (leitura)",
    });
  });

  it("outros erros continuam subindo (não esconde Bling fora do ar)", async () => {
    getProductSuppliers.mockRejectedValue(new real.BlingApiError(500, "/produtos/fornecedores", "erro"));
    await expect(resolverFornecedorPrincipalBling("conta-bling", 104, "user-1")).rejects.toThrow("erro");
  });
});
