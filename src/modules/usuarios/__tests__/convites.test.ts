import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = {
  usuario: { contaId: null as string | null },
  convite: null as null | {
    id: string;
    role: "COMPRAS";
    invitedBy: { id: string; contaId: string | null };
  },
  contagens: { membros: 0, produtos: 0, ml: 0, bling: 0, vendas: 0 },
};

const atualizacoes: unknown[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => estado.usuario),
      count: vi.fn(async () => estado.contagens.membros),
      update: vi.fn((args: unknown) => {
        atualizacoes.push(args);
        return args;
      }),
    },
    produto: { count: vi.fn(async () => estado.contagens.produtos) },
    mercadoLivreAccount: { count: vi.fn(async () => estado.contagens.ml) },
    blingAccount: { count: vi.fn(async () => estado.contagens.bling) },
    vendaCanal: { count: vi.fn(async () => estado.contagens.vendas) },
    invitation: {
      findFirst: vi.fn(async () => estado.convite),
      update: vi.fn((args: unknown) => {
        atualizacoes.push(args);
        return args;
      }),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

const { aplicarConvitePendente, normalizarEmail } = await import("../convites");

beforeEach(() => {
  atualizacoes.length = 0;
  estado.usuario = { contaId: null };
  estado.convite = { id: "conv-1", role: "COMPRAS", invitedBy: { id: "dono-1", contaId: null } };
  estado.contagens = { membros: 0, produtos: 0, ml: 0, bling: 0, vendas: 0 };
});

describe("convites", () => {
  it("normaliza e-mail", () => {
    expect(normalizarEmail("  Maria@Loja.COM ")).toBe("maria@loja.com");
  });

  it("coloca na conta de quem convidou quem ainda não tem dados próprios", async () => {
    const resultado = await aplicarConvitePendente("novo-1", "maria@loja.com");
    expect(resultado).toMatchObject({ contaId: "dono-1", role: "COMPRAS" });
    expect(atualizacoes).toHaveLength(2);
  });

  it("não mexe em quem já tem loja própria", async () => {
    estado.contagens.produtos = 3;
    expect(await aplicarConvitePendente("novo-1", "maria@loja.com")).toBeNull();
    expect(atualizacoes).toHaveLength(0);
  });

  it("não mexe em quem já pertence a uma conta", async () => {
    estado.usuario = { contaId: "outra" };
    expect(await aplicarConvitePendente("novo-1", "maria@loja.com")).toBeNull();
  });

  it("ignora quando não há convite válido", async () => {
    estado.convite = null;
    expect(await aplicarConvitePendente("novo-1", "maria@loja.com")).toBeNull();
  });
});
