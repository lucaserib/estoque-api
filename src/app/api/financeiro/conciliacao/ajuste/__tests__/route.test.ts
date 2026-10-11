import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarRelatorioConciliacaoMock = vi.fn();
const gerarLancamentoAjusteConciliacaoMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/conciliacao", () => ({
  gerarRelatorioConciliacao: (...args: unknown[]) => gerarRelatorioConciliacaoMock(...args),
  gerarLancamentoAjusteConciliacao: (...args: unknown[]) => gerarLancamentoAjusteConciliacaoMock(...args),
}));

function criarRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/conciliacao/ajuste", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarRelatorioConciliacaoMock.mockReset();
  gerarLancamentoAjusteConciliacaoMock.mockReset();
});

describe("POST /api/financeiro/conciliacao/ajuste", () => {
  it("responde 403 para quem não tem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "LEITURA" });

    const response = await POST(criarRequest({ mes: "2026-05", tipo: "TARIFA_VENDA" }) as never);
    expect(response.status).toBe(403);
  });

  it("responde 400 sem mes ou tipo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });

    const response = await POST(criarRequest({ mes: "2026-05" }) as never);
    expect(response.status).toBe(400);
  });

  it("responde 404 quando o tipo não existe no relatório", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    gerarRelatorioConciliacaoMock.mockResolvedValue({ mesReferencia: "2026-05", linhas: [] });

    const response = await POST(criarRequest({ mes: "2026-05", tipo: "TARIFA_VENDA" }) as never);
    expect(response.status).toBe(404);
  });

  it("gera o lançamento de ajuste usando a linha do relatório", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    const linha = { tipo: "TARIFA_VENDA", totalPedidos: 1000, totalFatura: 1100, diferenca: 100, diferencaPercentual: 0.1, alerta: true };
    gerarRelatorioConciliacaoMock.mockResolvedValue({ mesReferencia: "2026-05", linhas: [linha] });
    gerarLancamentoAjusteConciliacaoMock.mockResolvedValue({ id: "lanc-1" });

    const response = await POST(criarRequest({ mes: "2026-05", tipo: "TARIFA_VENDA" }) as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("lanc-1");
    expect(gerarLancamentoAjusteConciliacaoMock).toHaveBeenCalledWith(
      "conta-1", "user-1", "MERCADO_LIVRE", "2026-05", linha
    );
  });
});
