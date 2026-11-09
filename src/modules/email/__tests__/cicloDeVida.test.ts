import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  automacaoEmail: { findMany: vi.fn() },
  eventoProduto: { findMany: vi.fn(async (_args?: unknown): Promise<Array<Record<string, unknown>>> => []) },
  subscription: { findMany: vi.fn(async (_args?: unknown): Promise<Array<Record<string, unknown>>> => []) },
  loteCreditoIa: { findMany: vi.fn(async (_args?: unknown): Promise<Array<Record<string, unknown>>> => []) },
  user: { findMany: vi.fn() },
  notification: { create: vi.fn(async () => ({})) },
}));
const automacoes = vi.hoisted(() => ({
  garantirAutomacoes: vi.fn(async () => undefined),
  dispararAutomacao: vi.fn(async () => ({ id: "e1", status: "ENFILEIRADO", novo: true })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../automacoes", () => automacoes);
vi.mock("@/modules/clientes/eventos", () => ({ registrarEvento: vi.fn(async () => true) }));

import { processarCicloDeVida } from "../cicloDeVida";

const AGORA = new Date("2026-11-20T12:00:00.000Z");
const automacao = (chave: string, atrasoHoras = 0) => ({ chave, ativo: true, atrasoHoras });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({ id, email: `${id}@loja.com` }))
  );
});

describe("ciclo de vida", () => {
  it("conectar-ml: contas de 24 h sem Mercado Livre, uma vez por conta", async () => {
    prismaMock.automacaoEmail.findMany.mockResolvedValue([automacao("conectar-ml", 24)]);
    prismaMock.eventoProduto.findMany.mockImplementation(async (args?: unknown) =>
      (args as { where: { nome: string } }).where.nome === "CONTA_CRIADA" ? [{ contaId: "c1" }, { contaId: "c2" }] : [{ contaId: "c2" }]
    );
    const resultado = await processarCicloDeVida(AGORA);
    expect(resultado).toMatchObject({ candidatos: 1, enviados: 1 });
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(
      expect.objectContaining({ chave: "conectar-ml", contaId: "c1", chaveIdempotencia: "conectar-ml:c1" })
    );
  });

  it("teste-acabando: manda com a data e cria a notificação", async () => {
    prismaMock.automacaoEmail.findMany.mockResolvedValue([automacao("teste-acabando")]);
    prismaMock.subscription.findMany.mockResolvedValue([{ userId: "c1", trialEndsAt: new Date("2026-11-21T15:00:00.000Z") }]);
    await processarCicloDeVida(AGORA);
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(
      expect.objectContaining({ chaveIdempotencia: "teste-acabando:c1:2026-11-21", variaveis: { data_fim_teste: "21/11/2026" } })
    );
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "c1", type: "ASSINATURA" }) }));
  });

  it("e-mail já enviado (ou suprimido por descadastro) não gera notificação de novo", async () => {
    prismaMock.automacaoEmail.findMany.mockResolvedValue([automacao("teste-acabando")]);
    prismaMock.subscription.findMany.mockResolvedValue([{ userId: "c1", trialEndsAt: new Date("2026-11-21T15:00:00.000Z") }]);
    automacoes.dispararAutomacao.mockResolvedValueOnce({ id: "e1", status: "ENVIADO", novo: false });
    const resultado = await processarCicloDeVida(AGORA);
    expect(resultado).toMatchObject({ enviados: 0, ignorados: 1 });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("pagamento-falhou: lembrete 3 dias depois só se continuar inadimplente", async () => {
    prismaMock.automacaoEmail.findMany.mockResolvedValue([automacao("pagamento-falhou", 72)]);
    prismaMock.eventoProduto.findMany.mockResolvedValue([
      { id: "ev1", contaId: "c1" },
      { id: "ev2", contaId: "c2" },
    ]);
    prismaMock.subscription.findMany.mockResolvedValue([{ userId: "c1" }]);
    await processarCicloDeVida(AGORA);
    expect(automacoes.dispararAutomacao).toHaveBeenCalledTimes(1);
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(expect.objectContaining({ chaveIdempotencia: "pagamento-falhou:c1:lembrete:ev1" }));
  });

  it("automação desligada no admin não é avaliada", async () => {
    prismaMock.automacaoEmail.findMany.mockResolvedValue([]);
    expect(await processarCicloDeVida(AGORA)).toMatchObject({ automacoes: 0, enviados: 0 });
    expect(prismaMock.automacaoEmail.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ativo: true }) }));
  });
});
