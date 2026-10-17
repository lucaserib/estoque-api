import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));

vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: {
    getValidToken: vi.fn(async () => "fake-token"),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async () => ({ id: "conta-ml-1" })),
    },
  },
}));

function criarRequest(query: string) {
  return new NextRequest(
    `http://localhost/api/financeiro/diagnostico/mercado-livre${query}`
  );
}

describe("GET /api/financeiro/diagnostico/mercado-livre", () => {
  beforeEach(() => {
    verifyUserMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("responde 403 para quem não é ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest("?pedido=123"));
    expect(response.status).toBe(403);
  });

  it("responde 400 sem o parâmetro pedido", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest(""));
    expect(response.status).toBe(400);
  });

  it("remove dados pessoais do comprador e devolve pedido/descontos/envio/pagamentos", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/orders/123/discounts")) {
        return new Response(JSON.stringify({ full: 500, seller: 300 }), {
          status: 200,
        });
      }
      if (url.includes("/shipments/999/costs")) {
        return new Response(
          JSON.stringify({ senders: [{ cost: 1500, compensation: 0 }] }),
          { status: 200 }
        );
      }
      if (url.includes("/orders/123")) {
        return new Response(
          JSON.stringify({
            id: "123",
            status: "paid",
            buyer: { id: 1, email: "comprador@exemplo.com", first_name: "Fulano" },
            shipping: { id: 999 },
            payments: [{ id: 1, email: "comprador@exemplo.com", status: "approved" }],
          }),
          { status: 200 }
        );
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../route");
    const response = await GET(criarRequest("?pedido=123"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pedido.buyer).toBeUndefined();
    expect(body.pedido.status).toBe("paid");
    expect(body.descontos.full).toBe(500);
    expect(body.custosEnvio.senders[0].cost).toBe(1500);
    expect(body.pagamentos[0].email).toBeUndefined();
    expect(body.pagamentos[0].status).toBe("approved");
  });

  it("sinaliza custosEnvio como erro quando o pedido não tem shipping.id", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/orders/555/discounts")) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (url.includes("/orders/555")) {
        return new Response(
          JSON.stringify({ id: "555", status: "paid", shipping: null }),
          { status: 200 }
        );
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../route");
    const response = await GET(criarRequest("?pedido=555"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.custosEnvio.erro).toBe(true);
  });

  it("F3 (Ciclo 8): tipo=envio devolve o bruto e o mapeado lado a lado", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/shipments/999")) {
        return new Response(JSON.stringify({ id: 999, logistic_type: "self_service" }), { status: 200 });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../route");
    const response = await GET(criarRequest("?tipo=envio&id=999"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bruto.logistic_type).toBe("self_service");
    expect(body.mapeado.logistica).toBe("self_service");
    expect(body.mapeado.confianca).toBe("CONFIRMADO");
  });

  it("F3 (Ciclo 8): tipo sem id/pedido/dia/mes correspondente devolve 400", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const { GET } = await import("../route");
    const response = await GET(criarRequest("?tipo=envio"));

    expect(response.status).toBe(400);
  });

  it("F3 (Ciclo 8): tipo desconhecido devolve 400", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const { GET } = await import("../route");
    const response = await GET(criarRequest("?tipo=inexistente"));

    expect(response.status).toBe(400);
  });
});
