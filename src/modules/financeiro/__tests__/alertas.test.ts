import { describe, it, expect, vi, beforeEach } from "vitest";
import { competenciaDe } from "../dominio/periodo";

function mesReferenciaAtual(): string {
  const { ano, mes } = competenciaDe(new Date());
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

interface FakeLancamento {
  id: string;
  userId: string;
  status: string;
  vencimento: Date;
  descricao: string;
  valor: number;
}
interface FakeVenda {
  id: string;
  userId: string;
  completo: boolean;
  margemContribuicao: number | null;
  dataVenda: Date;
  pedidoExternoId: string;
}

let lancamentos: FakeLancamento[] = [];
let vendas: FakeVenda[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lancamentoFinanceiro: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; status: string; vencimento: { gte?: Date; lte?: Date; lt?: Date } };
        }) =>
          lancamentos.filter((l) => {
            if (l.userId !== where.userId || l.status !== where.status) return false;
            if (where.vencimento.gte && l.vencimento.getTime() < where.vencimento.gte.getTime()) return false;
            if (where.vencimento.lte && l.vencimento.getTime() > where.vencimento.lte.getTime()) return false;
            if (where.vencimento.lt && l.vencimento.getTime() >= where.vencimento.lt.getTime()) return false;
            return true;
          })
      ),
    },
    vendaCanal: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; completo: boolean; margemContribuicao: { lt: number }; dataVenda: { gte: Date } };
        }) =>
          vendas.filter(
            (v) =>
              v.userId === where.userId &&
              v.completo === where.completo &&
              v.margemContribuicao != null &&
              v.margemContribuicao < where.margemContribuicao.lt &&
              v.dataVenda.getTime() >= where.dataVenda.gte.getTime()
          )
      ),
    },
  },
}));

const notifyContaAVencerMock = vi.fn();
const notifyContaVencidaMock = vi.fn();
const notifyVendaComPrejuizoMock = vi.fn();
const notifyDivergenciaConciliacaoMock = vi.fn();
vi.mock("@/services/notificationService", () => ({
  NotificationService: {
    notifyContaAVencer: (...args: unknown[]) => notifyContaAVencerMock(...args),
    notifyContaVencida: (...args: unknown[]) => notifyContaVencidaMock(...args),
    notifyVendaComPrejuizo: (...args: unknown[]) => notifyVendaComPrejuizoMock(...args),
    notifyDivergenciaConciliacao: (...args: unknown[]) => notifyDivergenciaConciliacaoMock(...args),
  },
}));

const gerarRelatorioConciliacaoMock = vi.fn();
vi.mock("../relatorios/conciliacao", () => ({
  gerarRelatorioConciliacao: (...args: unknown[]) => gerarRelatorioConciliacaoMock(...args),
}));

const { gerarAlertasFinanceiros } = await import("../alertas");

function lancamento(overrides: Partial<FakeLancamento> & { id: string }): FakeLancamento {
  return { userId: "user-1", status: "PREVISTO", descricao: "Despesa", valor: 10000, vencimento: new Date(), ...overrides };
}
function venda(overrides: Partial<FakeVenda> & { id: string }): FakeVenda {
  return { userId: "user-1", completo: true, margemContribuicao: -1000, dataVenda: new Date(), pedidoExternoId: "123", ...overrides };
}

beforeEach(() => {
  lancamentos = [];
  vendas = [];
  notifyContaAVencerMock.mockReset();
  notifyContaVencidaMock.mockReset();
  notifyVendaComPrejuizoMock.mockReset();
  notifyDivergenciaConciliacaoMock.mockReset();
  gerarRelatorioConciliacaoMock.mockReset();
  gerarRelatorioConciliacaoMock.mockResolvedValue({ mesReferencia: "2026-10", canal: "MERCADO_LIVRE", linhas: [] });
});

describe("gerarAlertasFinanceiros", () => {
  it("notifica lançamento previsto que vence amanhã", async () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    lancamentos.push(lancamento({ id: "l1", vencimento: amanha }));

    const resultado = await gerarAlertasFinanceiros("user-1");

    expect(resultado.contasAVencer).toBe(1);
    expect(notifyContaAVencerMock).toHaveBeenCalledWith("user-1", "l1", "Despesa", 10000);
  });

  it("notifica lançamento previsto já vencido", async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    lancamentos.push(lancamento({ id: "l2", vencimento: ontem }));

    const resultado = await gerarAlertasFinanceiros("user-1");

    expect(resultado.contasVencidas).toBe(1);
    expect(notifyContaVencidaMock).toHaveBeenCalledWith("user-1", "l2", "Despesa", 10000);
  });

  it("não notifica lançamento com vencimento distante", async () => {
    const proximoMes = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    lancamentos.push(lancamento({ id: "l3", vencimento: proximoMes }));

    const resultado = await gerarAlertasFinanceiros("user-1");

    expect(resultado.contasAVencer).toBe(0);
    expect(resultado.contasVencidas).toBe(0);
    expect(notifyContaAVencerMock).not.toHaveBeenCalled();
    expect(notifyContaVencidaMock).not.toHaveBeenCalled();
  });

  it("notifica venda completa com margem negativa nos últimos 3 dias", async () => {
    vendas.push(venda({ id: "v1", margemContribuicao: -500 }));

    const resultado = await gerarAlertasFinanceiros("user-1");

    expect(resultado.vendasComPrejuizo).toBe(1);
    expect(notifyVendaComPrejuizoMock).toHaveBeenCalledWith("user-1", "v1", "123", -500);
  });

  it("não notifica venda incompleta mesmo com margem negativa", async () => {
    vendas.push(venda({ id: "v2", completo: false, margemContribuicao: -500 }));

    const resultado = await gerarAlertasFinanceiros("user-1");

    expect(resultado.vendasComPrejuizo).toBe(0);
    expect(notifyVendaComPrejuizoMock).not.toHaveBeenCalled();
  });

  it("notifica só as linhas de conciliação com alerta=true", async () => {
    gerarRelatorioConciliacaoMock.mockResolvedValue({
      mesReferencia: mesReferenciaAtual(),
      canal: "MERCADO_LIVRE",
      linhas: [
        { tipo: "TARIFA_VENDA", totalPedidos: 1000, totalFatura: 1200, diferenca: 200, diferencaPercentual: 0.2, alerta: true },
        { tipo: "FRETE", totalPedidos: 1000, totalFatura: 1005, diferenca: 5, diferencaPercentual: 0.005, alerta: false },
      ],
    });

    const resultado = await gerarAlertasFinanceiros("user-1");

    expect(resultado.divergenciasConciliacao).toBe(1);
    expect(notifyDivergenciaConciliacaoMock).toHaveBeenCalledWith("user-1", mesReferenciaAtual(), "Tarifa de venda", 200);
  });
});
