import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeConta {
  id: string;
  userId: string;
  nome: string;
  tipo: string;
  saldoInicial: number;
  dataSaldoInicial: Date;
  diaFechamento: number | null;
  diaVencimento: number | null;
  limite: number | null;
  ativo: boolean;
}

let contas: FakeConta[] = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contaFinanceira: {
      findMany: vi.fn(
        async ({ where }: { where: { userId: string; ativo?: boolean } }) =>
          contas.filter((c) => c.userId === where.userId && (where.ativo === undefined || c.ativo === where.ativo))
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) =>
          contas.find((c) => c.id === where.id && c.userId === where.userId) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeConta, "id" | "ativo"> }) => {
        const nova = { id: `conta-${proximoId++}`, ativo: true, ...data };
        contas.push(nova);
        return nova;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeConta> }) => {
          const conta = contas.find((c) => c.id === where.id);
          if (!conta) throw new Error("não encontrada");
          Object.assign(conta, data);
          return conta;
        }
      ),
    },
  },
}));

const {
  listarContasFinanceiras,
  criarContaFinanceira,
  atualizarContaFinanceira,
  ContaFinanceiraNaoEncontradaError,
} = await import("../contasFinanceiras");

beforeEach(() => {
  contas = [];
  proximoId = 1;
});

describe("listarContasFinanceiras", () => {
  it("filtra por ativas por padrão", async () => {
    contas.push(
      { id: "a", userId: "user-1", nome: "Banco", tipo: "BANCO", saldoInicial: 0, dataSaldoInicial: new Date(), diaFechamento: null, diaVencimento: null, limite: null, ativo: true },
      { id: "b", userId: "user-1", nome: "Cartão antigo", tipo: "CARTAO_CREDITO", saldoInicial: 0, dataSaldoInicial: new Date(), diaFechamento: 10, diaVencimento: 17, limite: null, ativo: false }
    );

    const resultado = await listarContasFinanceiras("user-1");
    expect(resultado.map((c) => c.nome)).toEqual(["Banco"]);
  });
});

describe("criarContaFinanceira", () => {
  it("cria com os campos informados", async () => {
    const conta = await criarContaFinanceira("user-1", {
      nome: "Cartão Nubank", tipo: "CARTAO_CREDITO" as never, saldoInicial: 0,
      dataSaldoInicial: new Date("2026-01-01"), diaFechamento: 10, diaVencimento: 17,
    });

    expect(conta.diaFechamento).toBe(10);
    expect(conta.diaVencimento).toBe(17);
  });
});

describe("atualizarContaFinanceira", () => {
  it("lança ContaFinanceiraNaoEncontradaError para conta de outra conta", async () => {
    contas.push({ id: "a", userId: "outra-conta", nome: "X", tipo: "BANCO", saldoInicial: 0, dataSaldoInicial: new Date(), diaFechamento: null, diaVencimento: null, limite: null, ativo: true });

    await expect(atualizarContaFinanceira("user-1", "a", { nome: "Y" })).rejects.toThrow(ContaFinanceiraNaoEncontradaError);
  });

  it("atualiza normalmente dentro da própria conta", async () => {
    contas.push({ id: "a", userId: "user-1", nome: "Banco", tipo: "BANCO", saldoInicial: 0, dataSaldoInicial: new Date(), diaFechamento: null, diaVencimento: null, limite: null, ativo: true });

    await atualizarContaFinanceira("user-1", "a", { saldoInicial: 50000 });
    expect(contas[0].saldoInicial).toBe(50000);
  });
});
