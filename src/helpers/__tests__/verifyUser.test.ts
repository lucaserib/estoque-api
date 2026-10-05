import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const tokenMock = vi.fn();
vi.mock("next-auth/jwt", () => ({
  getToken: tokenMock,
}));

interface MockUser {
  id: string;
  email: string;
  name: string | null;
  contaId: string | null;
}

const usuarios: MockUser[] = [
  { id: "dono-1", email: "dono@exemplo.com", name: "Dona", contaId: null },
  { id: "membro-1", email: "membro@exemplo.com", name: "Membro", contaId: "dono-1" },
];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return usuarios.find((u) => u.id === where.id) ?? null;
      }),
    },
  },
}));

const { verifyUser } = await import("@/helpers/verifyUser");

function requestWithHost(host = "app.exemplo.com"): NextRequest {
  return new NextRequest("https://app.exemplo.com/api/produtos", {
    headers: { host },
  });
}

beforeEach(() => {
  tokenMock.mockReset();
});

describe("verifyUser", () => {
  it("resolve contaId igual ao próprio id para o dono (contaId nulo no banco)", async () => {
    tokenMock.mockResolvedValue({ id: "dono-1" });

    const user = await verifyUser(requestWithHost());

    expect(user.id).toBe("dono-1");
    expect(user.contaId).toBe("dono-1");
  });

  it("resolve contaId como o id do dono para um membro convidado", async () => {
    tokenMock.mockResolvedValue({ id: "membro-1" });

    const user = await verifyUser(requestWithHost());

    expect(user.id).toBe("membro-1");
    expect(user.contaId).toBe("dono-1");
  });

  it("lança erro quando não há token", async () => {
    tokenMock.mockResolvedValue(null);

    await expect(verifyUser(requestWithHost())).rejects.toThrow();
  });

  it("lança erro quando o usuário do token não existe mais no banco", async () => {
    tokenMock.mockResolvedValue({ id: "fantasma" });

    await expect(verifyUser(requestWithHost())).rejects.toThrow();
  });
});
