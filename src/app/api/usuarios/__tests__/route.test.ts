import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "ADMIN" | "COMPRAS" | "ESTOQUE" | "VENDAS" | "LEITURA";
  contaId: string | null;
  createdAt: Date;
}

const usuarios: MockUser[] = [
  {
    id: "owner-a",
    name: "Dona A",
    email: "dona-a@exemplo.com",
    image: null,
    role: "ADMIN",
    contaId: null,
    createdAt: new Date("2026-01-01"),
  },
  {
    id: "membro-a",
    name: "Membro A",
    email: "membro-a@exemplo.com",
    image: null,
    role: "COMPRAS",
    contaId: "owner-a",
    createdAt: new Date("2026-01-02"),
  },
  {
    id: "owner-b",
    name: "Dona B",
    email: "dona-b@exemplo.com",
    image: null,
    role: "ADMIN",
    contaId: null,
    createdAt: new Date("2026-01-01"),
  },
];

function pertenceAConta(usuario: MockUser, contaId: string | null): boolean {
  return usuario.id === contaId || usuario.contaId === contaId;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async ({ where }: { where?: { OR?: Array<Record<string, unknown>> } }) => {
        if (!where?.OR) return [...usuarios];
        const contaId = (where.OR[0] as { id?: string }).id ?? null;
        return usuarios.filter((u) => pertenceAConta(u, contaId));
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return usuarios.find((u) => u.id === where.id) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockUser> }) => {
        const usuario = usuarios.find((u) => u.id === where.id);
        if (!usuario) throw new Error("not found");
        Object.assign(usuario, data);
        return { ...usuario };
      }),
    },
    invitation: {
      findMany: vi.fn(async () => []),
    },
  },
}));

const verifyUserMock = vi.fn();
vi.mock("@/helpers/verifyUser", () => ({
  verifyUser: verifyUserMock,
}));

const { GET } = await import("@/app/api/usuarios/route");
const { PATCH } = await import("@/app/api/usuarios/[id]/route");

function mockRequest(): Request {
  return new Request("http://localhost/api/usuarios");
}

function asCurrentUser(usuario: MockUser) {
  verifyUserMock.mockResolvedValue({
    ...usuario,
    contaId: usuario.contaId ?? usuario.id,
  });
}

beforeEach(() => {
  verifyUserMock.mockReset();
});

describe("GET /api/usuarios", () => {
  it("lista só os usuários da mesma conta", async () => {
    asCurrentUser(usuarios[0]);

    const response = await GET(mockRequest() as never);
    const body = await response.json();

    const ids = body.users.map((u: MockUser) => u.id);
    expect(ids.sort()).toEqual(["membro-a", "owner-a"]);
    expect(ids).not.toContain("owner-b");
  });
});

describe("PATCH /api/usuarios/[id]", () => {
  it("devolve 404 ao tentar alterar usuário de outra conta", async () => {
    asCurrentUser(usuarios[0]);

    const response = await PATCH(
      new Request("http://localhost/api/usuarios/owner-b", {
        method: "PATCH",
        body: JSON.stringify({ role: "LEITURA" }),
      }) as never,
      { params: Promise.resolve({ id: "owner-b" }) }
    );

    expect(response.status).toBe(404);
  });

  it("não permite alterar o papel do dono da conta", async () => {
    usuarios[1].role = "ADMIN";
    asCurrentUser(usuarios[1]);

    const response = await PATCH(
      new Request("http://localhost/api/usuarios/owner-a", {
        method: "PATCH",
        body: JSON.stringify({ role: "LEITURA" }),
      }) as never,
      { params: Promise.resolve({ id: "owner-a" }) }
    );

    expect(response.status).toBe(400);
    usuarios[1].role = "COMPRAS";
  });

  it("permite ao dono alterar o papel de um membro da própria conta", async () => {
    asCurrentUser(usuarios[0]);

    const response = await PATCH(
      new Request("http://localhost/api/usuarios/membro-a", {
        method: "PATCH",
        body: JSON.stringify({ role: "LEITURA" }),
      }) as never,
      { params: Promise.resolve({ id: "membro-a" }) }
    );

    expect(response.status).toBe(200);
    usuarios[1].role = "COMPRAS";
  });
});
