import { describe, it, expect, vi, beforeEach } from "vitest";
import { GrupoDre } from "@prisma/client";

interface MockCategoria {
  id: string;
  userId: string;
  nome: string;
  grupoDre: GrupoDre;
  paiId: string | null;
  sistema: boolean;
  ordem: number;
}

let categorias: MockCategoria[] = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    categoriaFinanceira: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; paiId: null; nome: { in: string[] } };
        }) => {
          return categorias
            .filter(
              (c) =>
                c.userId === where.userId &&
                c.paiId === where.paiId &&
                where.nome.in.includes(c.nome)
            )
            .map((c) => ({ nome: c.nome }));
        }
      ),
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Array<Omit<MockCategoria, "id" | "paiId">>;
          skipDuplicates?: boolean;
        }) => {
          let count = 0;
          for (const item of data) {
            const duplicado = categorias.some(
              (c) => c.userId === item.userId && c.paiId === null && c.nome === item.nome
            );
            if (duplicado) continue;
            categorias.push({ id: `cat-${proximoId++}`, paiId: null, ...item });
            count++;
          }
          return { count };
        }
      ),
    },
  },
}));

const { seedPlanoContasPadrao } = await import("../planoContasPadrao");

beforeEach(() => {
  categorias = [];
  proximoId = 1;
});

describe("seedPlanoContasPadrao", () => {
  it("cria as 20 categorias padrão na primeira chamada, todas marcadas como sistema", async () => {
    const resultado = await seedPlanoContasPadrao("conta-a");

    expect(resultado.criadas).toBe(20);
    expect(categorias).toHaveLength(20);
    expect(categorias.every((c) => c.sistema)).toBe(true);
  });

  it("não duplica categorias ao rodar duas vezes para a mesma conta", async () => {
    await seedPlanoContasPadrao("conta-a");
    const resultado = await seedPlanoContasPadrao("conta-a");

    expect(resultado.criadas).toBe(0);
    expect(resultado.existentes).toBe(20);
    expect(categorias).toHaveLength(20);
  });

  it("isola categorias entre contas diferentes", async () => {
    await seedPlanoContasPadrao("conta-a");
    await seedPlanoContasPadrao("conta-b");

    expect(categorias.filter((c) => c.userId === "conta-a")).toHaveLength(20);
    expect(categorias.filter((c) => c.userId === "conta-b")).toHaveLength(20);
    expect(categorias).toHaveLength(40);
  });

  it("mesmo nome em contas diferentes não é tratado como duplicado", async () => {
    await seedPlanoContasPadrao("conta-a");
    const resultado = await seedPlanoContasPadrao("conta-b");

    expect(resultado.criadas).toBe(20);
  });
});
