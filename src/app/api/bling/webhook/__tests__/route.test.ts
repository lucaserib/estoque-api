import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

const SECRET = "segredo-teste";
process.env.BLING_CLIENT_SECRET = SECRET;

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => unknown) => {
      void callback();
    },
  };
});

vi.mock("@/services/blingWebhookProcessor", async () => {
  const actual = await vi.importActual<typeof import("@/services/blingWebhookProcessor")>(
    "@/services/blingWebhookProcessor"
  );
  return {
    ...actual,
    processarEventoWebhookBling: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/prisma", () => {
  const eventos = new Map<string, { id: string; eventId: string }>();
  return {
    prisma: {
      blingWebhookEvent: {
        findUnique: vi.fn(async ({ where }: { where: { eventId: string } }) => {
          return eventos.get(where.eventId) ?? null;
        }),
        create: vi.fn(async ({ data }: { data: { eventId: string } }) => {
          const registro = { id: `id-${eventos.size + 1}`, eventId: data.eventId };
          eventos.set(data.eventId, registro);
          return registro;
        }),
      },
    },
  };
});

const { POST } = await import("@/app/api/bling/webhook/route");
const { NextRequest } = await import("next/server");

function assinar(corpo: string): string {
  return `sha256=${crypto.createHmac("sha256", SECRET).update(corpo, "utf8").digest("hex")}`;
}

function criarRequest(corpo: string, assinatura: string | null) {
  return new NextRequest("http://localhost/api/bling/webhook", {
    method: "POST",
    body: corpo,
    headers: assinatura ? { "X-Bling-Signature-256": assinatura } : {},
  });
}

describe("POST /api/bling/webhook", () => {
  it("responde 401 quando a assinatura é inválida", async () => {
    const corpo = JSON.stringify({
      eventId: "evt-1",
      event: "product.updated",
      companyId: "1",
      data: { id: 1 },
    });

    const response = await POST(criarRequest(corpo, "sha256=assinatura-errada"));
    expect(response.status).toBe(401);
  });

  it("responde 401 quando não há header de assinatura", async () => {
    const corpo = JSON.stringify({ eventId: "evt-2", event: "product.updated" });
    const response = await POST(criarRequest(corpo, null));
    expect(response.status).toBe(401);
  });

  it("processa o mesmo eventId apenas uma vez", async () => {
    const corpo = JSON.stringify({
      eventId: "evt-dedupe",
      event: "product.updated",
      companyId: "1",
      data: { id: 1 },
    });
    const assinatura = assinar(corpo);

    const primeira = await POST(criarRequest(corpo, assinatura));
    const primeiraBody = await primeira.json();
    expect(primeira.status).toBe(200);
    expect(primeiraBody.duplicado).toBeUndefined();

    const segunda = await POST(criarRequest(corpo, assinatura));
    const segundaBody = await segunda.json();
    expect(segunda.status).toBe(200);
    expect(segundaBody.duplicado).toBe(true);
  });
});
