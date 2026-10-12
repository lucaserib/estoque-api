import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
}

let notificacoes: FakeNotification[] = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(
        async ({ where }: { where: { userId: string; type: string; link: string | null; readAt: null } }) =>
          notificacoes.find(
            (n) =>
              n.userId === where.userId &&
              n.type === where.type &&
              n.link === where.link &&
              n.readAt === null
          ) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeNotification, "id" | "readAt"> }) => {
        const nova: FakeNotification = { id: `notif-${proximoId++}`, readAt: null, ...data };
        notificacoes.push(nova);
        return nova;
      }),
    },
  },
}));

const { NotificationService } = await import("../notificationService");

beforeEach(() => {
  notificacoes = [];
  proximoId = 1;
});

describe("NotificationService — alertas do financeiro (Ciclo 7 Fase 8)", () => {
  it("notifyContaAVencer cria com type correto e link único por lançamento", async () => {
    await NotificationService.notifyContaAVencer("user-1", "lanc-1", "Aluguel", 150000);

    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0].type).toBe("CONTA_A_VENCER");
    expect(notificacoes[0].link).toBe("/financeiro/lancamentos?destaque=lanc-1");
    expect(notificacoes[0].body).toContain("Aluguel");
    expect(notificacoes[0].body).toContain("R$");
  });

  it("notifyContaVencida cria com type correto", async () => {
    await NotificationService.notifyContaVencida("user-1", "lanc-2", "Fornecedor X", 50000);

    expect(notificacoes[0].type).toBe("CONTA_VENCIDA");
    expect(notificacoes[0].link).toBe("/financeiro/lancamentos?destaque=lanc-2");
  });

  it("notifyVendaComPrejuizo cria com type correto e referencia o pedido", async () => {
    await NotificationService.notifyVendaComPrejuizo("user-1", "venda-1", "123456789", -2000);

    expect(notificacoes[0].type).toBe("VENDA_COM_PREJUIZO");
    expect(notificacoes[0].body).toContain("123456789");
    expect(notificacoes[0].link).toBe("/financeiro/vendas?destaque=venda-1");
  });

  it("notifyDivergenciaConciliacao cria com type correto e link por mes", async () => {
    await NotificationService.notifyDivergenciaConciliacao("user-1", "2026-05", "Tarifa de venda", 3000);

    expect(notificacoes[0].type).toBe("DIVERGENCIA_CONCILIACAO");
    expect(notificacoes[0].link).toBe("/financeiro/configuracoes?mesConciliacao=2026-05");
  });

  it("não duplica notificação não lida do mesmo lançamento", async () => {
    await NotificationService.notifyContaVencida("user-1", "lanc-3", "Luz", 10000);
    await NotificationService.notifyContaVencida("user-1", "lanc-3", "Luz", 10000);

    expect(notificacoes).toHaveLength(1);
  });

  it("cria uma notificação nova para cada lançamento diferente", async () => {
    await NotificationService.notifyContaVencida("user-1", "lanc-4", "Água", 5000);
    await NotificationService.notifyContaVencida("user-1", "lanc-5", "Internet", 8000);

    expect(notificacoes).toHaveLength(2);
  });
});
