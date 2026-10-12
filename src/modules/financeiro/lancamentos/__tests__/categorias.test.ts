import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeCategoria {
  id: string;
  userId: string;
  nome: string;
  grupoDre: string;
  paiId: string | null;
  sistema: boolean;
  ativo: boolean;
  ordem: number;
}

let categorias: FakeCategoria[] = [];
let proximoId = 1;

const seedPlanoContasPadraoMock = vi.fn();
vi.mock("../planoContasPadrao", () => ({
  seedPlanoContasPadrao: (userId: string) => seedPlanoContasPadraoMock(userId),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    categoriaFinanceira: {
      findMany: vi.fn(
        async ({ where }: { where: { userId: string; ativo?: boolean } }) =>
          categorias.filter((c) => c.userId === where.userId && (where.ativo === undefined || c.ativo === where.ativo))
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) =>
          categorias.find((c) => c.id === where.id && c.userId === where.userId) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeCategoria, "id"> }) => {
        const nova = { id: `cat-${proximoId++}`, ...data };
        categorias.push(nova);
        return nova;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeCategoria> }) => {
          const categoria = categorias.find((c) => c.id === where.id);
          if (!categoria) throw new Error("não encontrada");
          Object.assign(categoria, data);
          return categoria;
        }
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        categorias = categorias.filter((c) => c.id !== where.id);
        return {};
      }),
    },
  },
}));

const {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  CategoriaNaoEncontradaError,
  CategoriaSistemaNaoPodeSerExcluidaError,
} = await import("../categorias");

beforeEach(() => {
  categorias = [];
  proximoId = 1;
  seedPlanoContasPadraoMock.mockReset();
});

describe("listarCategorias", () => {
  it("garante o seed antes de listar", async () => {
    await listarCategorias("user-1");
    expect(seedPlanoContasPadraoMock).toHaveBeenCalledWith("user-1");
  });

  it("filtra por ativas por padrão", async () => {
    categorias.push(
      { id: "c1", userId: "user-1", nome: "Ativa", grupoDre: "DESPESA_OPERACIONAL", paiId: null, sistema: false, ativo: true, ordem: 1 },
      { id: "c2", userId: "user-1", nome: "Inativa", grupoDre: "DESPESA_OPERACIONAL", paiId: null, sistema: false, ativo: false, ordem: 2 }
    );

    const resultado = await listarCategorias("user-1");
    expect(resultado.map((c) => c.nome)).toEqual(["Ativa"]);
  });
});

describe("criarCategoria", () => {
  it("cria uma categoria custom, nunca sistema", async () => {
    const categoria = await criarCategoria("user-1", { nome: "Nova", grupoDre: "DESPESA_OPERACIONAL" as never });
    expect(categoria.sistema).toBe(false);
  });
});

describe("atualizarCategoria / excluirCategoria", () => {
  it("lança CategoriaNaoEncontradaError para categoria de outra conta", async () => {
    categorias.push({ id: "c1", userId: "outra-conta", nome: "X", grupoDre: "DESPESA_OPERACIONAL", paiId: null, sistema: false, ativo: true, ordem: 1 });

    await expect(atualizarCategoria("user-1", "c1", { nome: "Y" })).rejects.toThrow(CategoriaNaoEncontradaError);
    await expect(excluirCategoria("user-1", "c1")).rejects.toThrow(CategoriaNaoEncontradaError);
  });

  it("permite desativar uma categoria sistema, mas não excluir", async () => {
    categorias.push({ id: "c1", userId: "user-1", nome: "Receitas de vendas", grupoDre: "RECEITA_BRUTA", paiId: null, sistema: true, ativo: true, ordem: 1 });

    await atualizarCategoria("user-1", "c1", { ativo: false });
    expect(categorias[0].ativo).toBe(false);

    await expect(excluirCategoria("user-1", "c1")).rejects.toThrow(CategoriaSistemaNaoPodeSerExcluidaError);
    expect(categorias).toHaveLength(1);
  });

  it("exclui normalmente uma categoria custom", async () => {
    categorias.push({ id: "c1", userId: "user-1", nome: "Custom", grupoDre: "DESPESA_OPERACIONAL", paiId: null, sistema: false, ativo: true, ordem: 1 });

    await excluirCategoria("user-1", "c1");
    expect(categorias).toHaveLength(0);
  });
});
