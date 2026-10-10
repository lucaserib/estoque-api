import { describe, it, expect, vi } from "vitest";

process.env.ML_CLIENT_ID = "app-123";

vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => unknown) => {
      void callback();
    },
  };
});

vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: {
    processWebhookEvent: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/prisma", () => {
  const notificacoes = new Map<string, { id: string }>();
  const mercadoLivreWebhook = {
    findUnique: vi.fn(
      async ({ where }: { where: { mlNotificationId: string } }) =>
        notificacoes.get(where.mlNotificationId) ?? null
    ),
    create: vi.fn(
      async ({ data }: { data: { mlNotificationId: string } }) => {
        const registro = { id: `id-${notificacoes.size + 1}` };
        notificacoes.set(data.mlNotificationId, registro);
        return registro;
      }
    ),
  };

  const mercadoLivreAccount = {
    findFirst: vi.fn(async ({ where }: { where: { mlUserId: string } }) =>
      where.mlUserId === "user-conhecido" ? { id: "account-1" } : null
    ),
  };

  return { prisma: { mercadoLivreWebhook, mercadoLivreAccount } };
});

const { POST } = await import("@/app/api/mercadolivre/webhook/route");
const { NextRequest } = await import("next/server");

function criarRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/mercadoLivre/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    _id: "notif-1",
    resource: "/items/MLB123",
    user_id: "user-conhecido",
    topic: "items",
    application_id: "app-123",
    ...overrides,
  };
}

describe("POST /api/mercadoLivre/webhook", () => {
  it("responde 200 e ignora quando application_id não bate com ML_CLIENT_ID", async () => {
    const response = await POST(
      criarRequest(payload({ _id: "notif-app-errado", application_id: "outro-app" }))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("responde 200 quando a conta não é encontrada, sem persistir evento", async () => {
    const response = await POST(
      criarRequest(
        payload({ _id: "notif-conta-desconhecida", user_id: "user-desconhecido" })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("deduplica pelo mesmo _id da notificação", async () => {
    const primeira = await POST(criarRequest(payload({ _id: "notif-dedupe" })));
    const primeiraBody = await primeira.json();
    expect(primeira.status).toBe(200);
    expect(primeiraBody.duplicado).toBeUndefined();

    const segunda = await POST(criarRequest(payload({ _id: "notif-dedupe" })));
    const segundaBody = await segunda.json();
    expect(segunda.status).toBe(200);
    expect(segundaBody.duplicado).toBe(true);
  });

  it("responde 400 quando faltam campos obrigatórios", async () => {
    const response = await POST(
      criarRequest({ resource: "/items/MLB123" })
    );
    expect(response.status).toBe(400);
  });
});
