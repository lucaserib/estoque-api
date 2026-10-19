import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock, getServerSessionMock } = vi.hoisted(() => ({
  verifyUserMock: vi.fn(),
  getServerSessionMock: vi.fn(),
}));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));
vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const notifyPedidoConcluidoMock = vi.fn();
vi.mock("@/services/notificationService", () => ({
  NotificationService: { notifyPedidoConcluido: (...args: unknown[]) => notifyPedidoConcluidoMock(...args) },
}));

const gerarContaAPagarDePedidoCompraMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/pedidoCompra", () => ({
  gerarContaAPagarDePedidoCompra: (...args: unknown[]) => gerarContaAPagarDePedidoCompraMock(...args),
}));

interface FakePedidoProduto {
  id: number;
  pedidoId: number;
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador: number;
}

interface FakePedido {
  id: number;
  userId: string;
  fornecedorId: string;
  status: string;
  armazemId: string | null;
  dataConclusao: Date | null;
  comentarios: string | null;
}

let pedidos: FakePedido[] = [];
let pedidoProdutos: FakePedidoProduto[] = [];
let estoques: Array<{ produtoId: string; armazemId: string; quantidade: number }> = [];
let produtos: Array<{ id: string; custoMedio: number }> = [];
let proximoPedidoId = 100;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    armazem: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "armazem-1" ? { id: "armazem-1" } : null
      ),
    },
    pedidoCompra: {
      findMany: vi.fn(async () =>
        pedidos.map((pedido) => ({
          ...pedido,
          fornecedor: { nome: "Fornecedor X" },
          produtos: pedidoProdutos
            .filter((pp) => pp.pedidoId === pedido.id)
            .map((pp) => ({ ...pp, produto: { custoMedio: 1000 } })),
        }))
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
        const pedido = pedidos.find((p) => p.id === where.id);
        if (!pedido) return null;
        return {
          ...pedido,
          produtos: pedidoProdutos.filter((pp) => pp.pedidoId === pedido.id),
          fornecedor: { nome: "Fornecedor X" },
        };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const pedido = pedidos.find((p) => p.id === where.id)!;
        Object.assign(pedido, data);
        return {
          ...pedido,
          produtos: pedidoProdutos
            .filter((pp) => pp.pedidoId === pedido.id)
            .map((pp) => ({ ...pp, produto: produtos.find((p) => p.id === pp.produtoId) })),
          fornecedor: { nome: "Fornecedor X" },
        };
      }),
      create: vi.fn(async ({ data }: { data: { userId: string; fornecedorId: string; comentarios: string; status: string; produtos: { create: Array<{ produtoId: string; quantidade: number; custo: number; multiplicador: number }> } } }) => {
        const novoId = ++proximoPedidoId;
        pedidos.push({
          id: novoId,
          userId: data.userId,
          fornecedorId: data.fornecedorId,
          status: data.status,
          armazemId: null,
          dataConclusao: null,
          comentarios: data.comentarios,
        });
        for (const p of data.produtos.create) {
          pedidoProdutos.push({ id: pedidoProdutos.length + 1, pedidoId: novoId, ...p });
        }
        return { id: novoId };
      }),
    },
    pedidoProduto: {
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const pp = pedidoProdutos.find((item) => item.id === where.id)!;
        Object.assign(pp, data);
        return pp;
      }),
    },
    estoque: {
      findFirst: vi.fn(async ({ where }: { where: { produtoId: string; armazemId: string } }) =>
        estoques.find((e) => e.produtoId === where.produtoId && e.armazemId === where.armazemId) ?? null
      ),
      findMany: vi.fn(async ({ where }: { where: { produtoId: string } }) =>
        estoques.filter((e) => e.produtoId === where.produtoId).map((e) => ({ quantidade: e.quantidade }))
      ),
      update: vi.fn(async ({ where, data }: { where: { produtoId_armazemId: { produtoId: string; armazemId: string } }; data: { quantidade: { increment: number } } }) => {
        const e = estoques.find(
          (item) =>
            item.produtoId === where.produtoId_armazemId.produtoId &&
            item.armazemId === where.produtoId_armazemId.armazemId
        )!;
        e.quantidade += data.quantidade.increment;
        return e;
      }),
      create: vi.fn(async ({ data }: { data: { produtoId: string; armazemId: string; quantidade: number } }) => {
        estoques.push({ ...data });
        return data;
      }),
    },
    produto: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const produto = produtos.find((p) => p.id === where.id);
        return produto ? { custoMedio: produto.custoMedio } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { custoMedio: number } }) => {
        const produto = produtos.find((p) => p.id === where.id)!;
        produto.custoMedio = data.custoMedio;
        return produto;
      }),
    },
    configuracaoGeral: {
      findUnique: vi.fn(async () => ({
        gerarContaAPagarAoConfirmarCompra: true,
        prazoPagamentoPadraoDias: 30,
      })),
    },
  },
}));

const { PUT, GET } = await import("../route");

function criarRequestPut(body: Record<string, unknown>) {
  return new Request("http://localhost/api/pedidos-compra", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  verifyUserMock.mockReset();
  verifyUserMock.mockResolvedValue({ id: "user-1", contaId: "conta-1", role: "ADMIN" });
  getServerSessionMock.mockReset();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1", contaId: "conta-1", role: "ADMIN" } });
  notifyPedidoConcluidoMock.mockReset();
  gerarContaAPagarDePedidoCompraMock.mockReset();
  pedidos = [];
  pedidoProdutos = [];
  estoques = [];
  produtos = [];
  proximoPedidoId = 100;
});

describe("PUT /api/pedidos-compra — confirmar recebimento", () => {
  it("soma ao estoque, recalcula o custo médio ponderado corretamente e gera a conta a pagar", async () => {
    pedidos.push({
      id: 1,
      userId: "conta-1",
      fornecedorId: "forn-1",
      status: "pendente",
      armazemId: null,
      dataConclusao: null,
      comentarios: null,
    });
    pedidoProdutos.push({
      id: 1,
      pedidoId: 1,
      produtoId: "produto-1",
      quantidade: 10,
      custo: 20000,
      multiplicador: 1,
    });
    estoques.push({ produtoId: "produto-1", armazemId: "armazem-1", quantidade: 10 });
    produtos.push({ id: "produto-1", custoMedio: 10000 });

    const response = await PUT(
      criarRequestPut({
        pedidoId: 1,
        armazemId: "armazem-1",
        produtosRecebidos: [
          { produtoId: "produto-1", quantidade: 10, custo: 20000, multiplicador: 1 },
        ],
      }) as never
    );
    expect(response.status).toBe(200);

    expect(estoques[0].quantidade).toBe(20);

    expect(produtos[0].custoMedio).toBe(15000);

    expect(gerarContaAPagarDePedidoCompraMock).toHaveBeenCalledWith(
      "conta-1",
      "user-1",
      1,
      expect.objectContaining({ vencimento: expect.any(Date) })
    );

    expect(pedidos[0].status).toBe("confirmado");
  });

  it("recebimento parcial gera um novo pedido pendente com a quantidade restante", async () => {
    pedidos.push({
      id: 1,
      userId: "conta-1",
      fornecedorId: "forn-1",
      status: "pendente",
      armazemId: null,
      dataConclusao: null,
      comentarios: null,
    });
    pedidoProdutos.push({
      id: 1,
      pedidoId: 1,
      produtoId: "produto-1",
      quantidade: 10,
      custo: 20000,
      multiplicador: 1,
    });
    produtos.push({ id: "produto-1", custoMedio: 0 });

    await PUT(
      criarRequestPut({
        pedidoId: 1,
        armazemId: "armazem-1",
        produtosRecebidos: [
          { produtoId: "produto-1", quantidade: 6, custo: 20000, multiplicador: 1 },
        ],
      }) as never
    );

    const pedidoRestante = pedidos.find((p) => p.id !== 1)!;
    expect(pedidoRestante).toBeDefined();
    expect(pedidoRestante.status).toBe("pendente");
    const itemRestante = pedidoProdutos.find((pp) => pp.pedidoId === pedidoRestante.id)!;
    expect(itemRestante.quantidade).toBe(4);
  });

  it("não gera conta a pagar quando a configuração da conta desativa isso", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.configuracaoGeral.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      gerarContaAPagarAoConfirmarCompra: false,
      prazoPagamentoPadraoDias: 30,
    });

    pedidos.push({
      id: 1,
      userId: "conta-1",
      fornecedorId: "forn-1",
      status: "pendente",
      armazemId: null,
      dataConclusao: null,
      comentarios: null,
    });
    pedidoProdutos.push({
      id: 1,
      pedidoId: 1,
      produtoId: "produto-1",
      quantidade: 10,
      custo: 20000,
      multiplicador: 1,
    });
    produtos.push({ id: "produto-1", custoMedio: 0 });

    await PUT(
      criarRequestPut({
        pedidoId: 1,
        armazemId: "armazem-1",
        produtosRecebidos: [
          { produtoId: "produto-1", quantidade: 10, custo: 20000, multiplicador: 1 },
        ],
      }) as never
    );

    expect(gerarContaAPagarDePedidoCompraMock).not.toHaveBeenCalled();
  });
});

function criarRequestGet() {
  return new NextRequest("http://localhost/api/pedidos-compra");
}

describe("GET /api/pedidos-compra", () => {
  it("esconde custo para ESTOQUE, que tem acesso de visualização mas não VER_CUSTO", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", contaId: "conta-1", role: "ESTOQUE" } });
    pedidos.push({
      id: 1,
      userId: "conta-1",
      fornecedorId: "forn-1",
      status: "pendente",
      armazemId: null,
      dataConclusao: null,
      comentarios: null,
    });
    pedidoProdutos.push({ id: 1, pedidoId: 1, produtoId: "produto-1", quantidade: 10, custo: 20000, multiplicador: 1 });

    const response = await GET(criarRequestGet());
    const body = await response.json();

    expect(body[0].produtos[0].custo).toBe(0);
    expect(body[0].produtos[0].produto.custoMedio).toBeNull();
  });

  it("mostra custo para ADMIN", async () => {
    pedidos.push({
      id: 1,
      userId: "conta-1",
      fornecedorId: "forn-1",
      status: "pendente",
      armazemId: null,
      dataConclusao: null,
      comentarios: null,
    });
    pedidoProdutos.push({ id: 1, pedidoId: 1, produtoId: "produto-1", quantidade: 10, custo: 20000, multiplicador: 1 });

    const response = await GET(criarRequestGet());
    const body = await response.json();

    expect(body[0].produtos[0].custo).toBe(20000);
    expect(body[0].produtos[0].produto.custoMedio).toBe(1000);
  });
});
