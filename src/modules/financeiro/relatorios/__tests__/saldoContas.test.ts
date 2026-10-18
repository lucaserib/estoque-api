import { describe, it, expect, vi, beforeEach } from "vitest";
import { criarBancoFalso } from "../../__tests__/bancoFalso";

const banco = criarBancoFalso();
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

const { listarContasComSaldo, ajustarSaldoConta, calcularSaldoTotalAtual } = await import("../saldoContas");

const DIA = 24 * 60 * 60 * 1000;

beforeEach(() => {
  banco.dados.vendas = [];
  banco.dados.lancamentos = [];
  banco.dados.contasFinanceiras = [];
  banco.dados.contasMl = [{ id: "conta-1", userId: "user-1", isActive: true, nickname: "LEAPSTORE" }];
});

describe("saldo da carteira do Mercado Pago", () => {
  it("cria a carteira sozinha e pede o saldo inicial", async () => {
    const contas = await listarContasComSaldo("user-1");
    expect(contas).toHaveLength(1);
    expect(contas[0].nome).toBe("Mercado Pago — LEAPSTORE");
    expect(contas[0].precisaAjuste).toBe(true);
  });

  it("depois do ajuste, soma o líquido das vendas liberadas e separa o que ainda vai liberar", async () => {
    await listarContasComSaldo("user-1");
    const carteira = banco.dados.contasFinanceiras[0];
    await ajustarSaldoConta("user-1", carteira.id as string, 100000);
    carteira.dataSaldoInicial = new Date(Date.now() - 10 * DIA);

    banco.dados.vendas.push(
      banco.venda({ valorLiquidoReceber: 1272, dataLiberacao: new Date(Date.now() - 2 * DIA) }),
      banco.venda({ valorLiquidoReceber: 5000, dataLiberacao: new Date(Date.now() - 20 * DIA) }),
      banco.venda({ valorLiquidoReceber: 900, dataLiberacao: new Date(Date.now() + 5 * DIA) }),
      banco.venda({ valorLiquidoReceber: 777, status: "CANCELADA", dataLiberacao: new Date(Date.now() - 1 * DIA) })
    );
    banco.dados.lancamentos.push({
      contaFinanceiraId: carteira.id,
      tipo: "DESPESA",
      valor: 30000,
      status: "PAGO",
      pagamento: new Date(Date.now() - DIA),
    });

    const [conta] = await listarContasComSaldo("user-1");
    expect(conta.liberadoDesdeAjuste).toBe(1272);
    expect(conta.saldoALiberar).toBe(900);
    expect(conta.saldoAtual).toBe(100000 + 1272 - 30000);
    expect(conta.precisaAjuste).toBe(false);
  });

  it("cartão de crédito não entra no saldo total", async () => {
    banco.dados.contasMl = [];
    banco.dados.contasFinanceiras.push(
      { id: "banco", userId: "user-1", ativo: true, tipo: "BANCO", nome: "Banco", saldoInicial: 10000, dataSaldoInicial: new Date("2026-01-01"), automatica: false, contaCanalId: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "cartao", userId: "user-1", ativo: true, tipo: "CARTAO_CREDITO", nome: "Cartão", saldoInicial: 99999, dataSaldoInicial: new Date("2026-01-01"), automatica: false, contaCanalId: null, createdAt: new Date(), updatedAt: new Date() }
    );
    expect(await calcularSaldoTotalAtual("user-1")).toBe(10000);
  });
});
