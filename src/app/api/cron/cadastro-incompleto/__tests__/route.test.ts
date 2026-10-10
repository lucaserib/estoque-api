import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.CRON_SECRET = "segredo-cron";

const notifyCadastroIncompletoMock = vi.fn(
  async (_userId: string, _quantidade: number) => undefined
);

vi.mock("@/services/notificationService", () => ({
  NotificationService: {
    notifyCadastroIncompleto: (userId: string, quantidade: number) =>
      notifyCadastroIncompletoMock(userId, quantidade),
  },
}));

const calcularTodasPendenciasMock = vi.fn();

vi.mock("@/services/pendenciasService", () => ({
  calcularTodasPendencias: (userId: string) =>
    calcularTodasPendenciasMock(userId),
}));

const { contaState, resetConta } = vi.hoisted(() => {
  const state = { ultimaContagemPendenciasCriticas: 0 };
  const reset = () => {
    state.ultimaContagemPendenciasCriticas = 0;
  };
  return { contaState: state, resetConta: reset };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async ({ where }: { where: { contaId?: null; role?: unknown } }) => {
        if ("contaId" in where) {
          return [{ id: "dono-1" }];
        }
        return [{ id: "dono-1" }, { id: "membro-admin" }];
      }),
    },
    configuracaoGeral: {
      findUnique: vi.fn(async () => ({ ...contaState })),
      upsert: vi.fn(async ({ update }: { update: { ultimaContagemPendenciasCriticas: number } }) => {
        contaState.ultimaContagemPendenciasCriticas =
          update.ultimaContagemPendenciasCriticas;
        return { ...contaState };
      }),
    },
  },
}));

function criticas(n: number) {
  return [
    {
      produtoId: "p1",
      nome: "Produto",
      sku: "SKU1",
      estoqueTotal: 0,
      custoMedio: null,
      pendencias: Array.from({ length: n }, (_, i) => ({
        codigo: `COD_${i}`,
        severidade: "critica" as const,
        mensagem: "x",
        acao: "y",
      })),
    },
  ];
}

function criarRequest() {
  return new Request("http://localhost/api/cron/cadastro-incompleto", {
    headers: { authorization: "Bearer segredo-cron" },
  });
}

describe("GET /api/cron/cadastro-incompleto", () => {
  beforeEach(() => {
    resetConta();
    notifyCadastroIncompletoMock.mockClear();
    calcularTodasPendenciasMock.mockReset();
  });

  it("responde 401 sem o CRON_SECRET correto", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/cron/cadastro-incompleto") as never
    );
    expect(response.status).toBe(401);
  });

  it("notifica quando a contagem de pendências críticas aumenta", async () => {
    calcularTodasPendenciasMock.mockResolvedValue(criticas(3));
    const { GET } = await import("../route");

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.contasNotificadas).toBe(1);
    expect(notifyCadastroIncompletoMock).toHaveBeenCalledTimes(2); // dono + membro admin
    expect(contaState.ultimaContagemPendenciasCriticas).toBe(3);
  });

  it("não notifica quando a contagem não aumenta", async () => {
    contaState.ultimaContagemPendenciasCriticas = 5;
    calcularTodasPendenciasMock.mockResolvedValue(criticas(5));
    const { GET } = await import("../route");

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.contasNotificadas).toBe(0);
    expect(notifyCadastroIncompletoMock).not.toHaveBeenCalled();
  });

  it("não notifica quando a contagem diminui, mas atualiza o valor salvo", async () => {
    contaState.ultimaContagemPendenciasCriticas = 10;
    calcularTodasPendenciasMock.mockResolvedValue(criticas(2));
    const { GET } = await import("../route");

    await GET(criarRequest() as never);

    expect(notifyCadastroIncompletoMock).not.toHaveBeenCalled();
    expect(contaState.ultimaContagemPendenciasCriticas).toBe(2);
  });
});
