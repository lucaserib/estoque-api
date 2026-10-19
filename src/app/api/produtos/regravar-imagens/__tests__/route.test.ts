import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findManyMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produto: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

const rehostTemporaryImageMock = vi.fn();
vi.mock("@/lib/blingImageHost", () => ({
  rehostTemporaryImage: (...args: unknown[]) => rehostTemporaryImageMock(...args),
}));

function criarRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/produtos/regravar-imagens", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findManyMock.mockReset();
  updateMock.mockReset();
  rehostTemporaryImageMock.mockReset();
});

describe("POST /api/produtos/regravar-imagens", () => {
  it("responde 403 para quem não é ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    const response = await POST(criarRequest() as never);
    expect(response.status).toBe(403);
  });

  it("regrava só as URLs assinadas, ignorando as que já são definitivas", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([
      { id: "p1", sku: "SKU-1", imagemUrl: "https://bucket.s3.amazonaws.com/a.jpg?X-Amz-Expires=3600" },
      { id: "p2", sku: "SKU-2", imagemUrl: "https://public.blob.vercel-storage.com/foto.jpg" },
    ]);
    rehostTemporaryImageMock.mockResolvedValue("https://public.blob.vercel-storage.com/nova.jpg");

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rehostTemporaryImageMock).toHaveBeenCalledTimes(1);
    expect(rehostTemporaryImageMock).toHaveBeenCalledWith(
      "https://bucket.s3.amazonaws.com/a.jpg?X-Amz-Expires=3600",
      "SKU-1"
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { imagemUrl: "https://public.blob.vercel-storage.com/nova.jpg" },
    });
    expect(body.regravados).toBe(1);
    expect(body.examinados).toBe(2);
  });

  it("falha ao buscar a imagem conta como erro, sem travar o lote", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([
      { id: "p1", sku: "SKU-1", imagemUrl: "https://bucket.s3.amazonaws.com/a.jpg?Expires=1" },
    ]);
    rehostTemporaryImageMock.mockResolvedValue(null);

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.erros).toBe(1);
    expect(body.regravados).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("devolve proximoCursor quando a página está cheia (ainda não concluído)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, sku: `SKU-${i}`, imagemUrl: null }))
    );

    const response = await POST(criarRequest({ cursor: "p-1" }) as never);
    const body = await response.json();

    expect(body.concluido).toBe(false);
    expect(body.proximoCursor).toBe("p99");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { gt: "p-1" } }) })
    );
  });

  it("conclui quando a página vem incompleta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([{ id: "p1", sku: "SKU-1", imagemUrl: null }]);

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.concluido).toBe(true);
    expect(body.proximoCursor).toBeNull();
  });
});
