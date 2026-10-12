import { describe, it, expect, vi, beforeEach } from "vitest";

const calcularPendenciasMock = vi.fn();
vi.mock("@/lib/pendencias", () => ({
  calcularPendencias: (...args: unknown[]) => calcularPendenciasMock(...args),
}));

interface FakeProduto {
  id: string;
  userId: string;
  nome: string;
  sku: string;
  isKit: boolean;
  custoMedio: number | null;
  precoVenda: number | null;
  ean: bigint | null;
  estoques: Array<{ armazemId: string; quantidade: number }>;
  componentes: Array<{ produto: { custoMedio: number | null } }>;
  fornecedores: Array<{ principal: boolean; prazoEntregaDias: number | null }>;
  ProdutoMercadoLivre: unknown[];
}
interface FakeItemVenda {
  produtoId: string | null;
  userId: string;
  completo: boolean;
  dataVenda: Date;
}

let produtos: FakeProduto[] = [];
let itensDeVenda: FakeItemVenda[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    produto: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        produtos.filter((p) => p.userId === where.userId)
      ),
    },
    armazem: {
      findMany: vi.fn(async () => []),
    },
    estoqueMovimentacao: {
      findMany: vi.fn(async () => []),
    },
    vendaCanalItem: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { venda: { userId: string; completo: boolean; dataVenda: { gte: Date } } };
        }) => {
          const vistos = new Set<string>();
          return itensDeVenda
            .filter(
              (i) =>
                i.produtoId !== null &&
                i.userId === where.venda.userId &&
                i.completo === where.venda.completo &&
                i.dataVenda.getTime() >= where.venda.dataVenda.gte.getTime()
            )
            .filter((i) => {
              if (vistos.has(i.produtoId as string)) return false;
              vistos.add(i.produtoId as string);
              return true;
            })
            .map((i) => ({ produtoId: i.produtoId }));
        }
      ),
    },
  },
}));

const { calcularTodasPendencias } = await import("../pendenciasService");

function produto(overrides: Partial<FakeProduto> & { id: string }): FakeProduto {
  return {
    userId: "user-1", nome: "Produto", sku: "SKU", isKit: false, custoMedio: 1000,
    precoVenda: 2000, ean: null, estoques: [], componentes: [], fornecedores: [],
    ProdutoMercadoLivre: [],
    ...overrides,
  };
}

beforeEach(() => {
  produtos = [];
  itensDeVenda = [];
  calcularPendenciasMock.mockReset();
  calcularPendenciasMock.mockReturnValue([]);
});

describe("calcularTodasPendencias", () => {
  it("marca vendaIncompleta=true para produto com venda incompleta nos últimos 30 dias", async () => {
    produtos.push(produto({ id: "p1" }));
    itensDeVenda.push({ produtoId: "p1", userId: "user-1", completo: false, dataVenda: new Date() });

    await calcularTodasPendencias("user-1");

    expect(calcularPendenciasMock).toHaveBeenCalledWith(
      expect.objectContaining({ vendaIncompleta: true })
    );
  });

  it("marca vendaIncompleta=false para produto sem venda incompleta", async () => {
    produtos.push(produto({ id: "p1" }));

    await calcularTodasPendencias("user-1");

    expect(calcularPendenciasMock).toHaveBeenCalledWith(
      expect.objectContaining({ vendaIncompleta: false })
    );
  });

  it("não cruza vendaIncompleta de um produto para outro", async () => {
    produtos.push(produto({ id: "p1" }), produto({ id: "p2" }));
    itensDeVenda.push({ produtoId: "p1", userId: "user-1", completo: false, dataVenda: new Date() });

    await calcularTodasPendencias("user-1");

    expect(calcularPendenciasMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ vendaIncompleta: true }));
    expect(calcularPendenciasMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ vendaIncompleta: false }));
  });

  it("devolve a lista no formato esperado pela rota de pendências", async () => {
    produtos.push(produto({ id: "p1", nome: "Camiseta", sku: "CAM1", custoMedio: 500, estoques: [{ armazemId: "a1", quantidade: 10 }] }));

    const resultado = await calcularTodasPendencias("user-1");

    expect(resultado).toEqual([
      { produtoId: "p1", nome: "Camiseta", sku: "CAM1", estoqueTotal: 10, custoMedio: 500, pendencias: [] },
    ]);
  });
});
